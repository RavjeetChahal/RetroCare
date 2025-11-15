"""
FastAPI service for voice anomaly detection.
Provides endpoints for embedding extraction and comparison.
"""
import os
import logging
import numpy as np
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv

from utils.audio import load_audio_from_url, get_embedding, compute_snr, load_model
from utils.scoring import (
    cosine_similarity,
    similarity_to_anomaly,
    apply_noise_normalization,
    apply_time_compensation,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown."""
    # Startup
    try:
        load_model()
        logger.info("Voice anomaly detection service started")
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        raise
    
    yield
    
    # Shutdown (if needed)
    logger.info("Shutting down voice anomaly detection service")


# Initialize FastAPI app
app = FastAPI(
    title="RetroCare Voice Anomaly Detection",
    description="Microservice for voice embedding extraction and anomaly detection",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:19006").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class EmbedRequest(BaseModel):
    audio_url: HttpUrl
    sample_rate: int = 16000


class EmbedResponse(BaseModel):
    embedding: List[float]
    snr: float
    sample_rate: int


class CompareRequest(BaseModel):
    baseline: List[float]
    current: List[float]
    snr: float
    hour: Optional[int] = None


class CompareResponse(BaseModel):
    score: float  # anomaly score 0.0-1.0
    raw_similarity: float  # cosine similarity
    normalized: float  # after noise/time adjustments
    snr: float


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "anomaly-detection",
        "model_loaded": True
    }


@app.post("/embed", response_model=EmbedResponse)
async def extract_embedding(request: EmbedRequest):
    """
    Extract voice embedding from audio URL.
    
    Downloads audio, extracts embedding using ECAPA-TDNN, and computes SNR.
    """
    try:
        logger.info(f"Extracting embedding from: {request.audio_url}")
        
        # Download and load audio
        waveform, sample_rate = await load_audio_from_url(
            str(request.audio_url),
            target_sr=request.sample_rate
        )
        
        # Extract embedding
        embedding = get_embedding(waveform, sample_rate)
        
        # Compute SNR
        snr = compute_snr(waveform, sample_rate)
        
        logger.info(f"Embedding extracted: shape={embedding.shape}, SNR={snr:.2f}dB")
        
        return EmbedResponse(
            embedding=embedding.tolist(),
            snr=snr,
            sample_rate=sample_rate
        )
        
    except Exception as e:
        logger.error(f"Error extracting embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract embedding: {str(e)}")


@app.post("/compare", response_model=CompareResponse)
async def compare_embeddings(request: CompareRequest):
    """
    Compare baseline and current embeddings.
    
    Computes cosine similarity, converts to anomaly score, and applies
    noise normalization and optional time-of-day compensation.
    """
    try:
        logger.info("Comparing embeddings")
        
        # Convert to numpy arrays
        baseline = np.array(request.baseline)
        current = np.array(request.current)
        
        # Check dimensions
        if baseline.shape != current.shape:
            raise ValueError(f"Embedding dimensions don't match: {baseline.shape} vs {current.shape}")
        
        # Compute cosine similarity
        similarity = cosine_similarity(baseline, current)
        logger.debug(f"Raw similarity: {similarity:.4f}")
        
        # Convert to anomaly score
        anomaly_score = similarity_to_anomaly(similarity)
        logger.debug(f"Anomaly score (raw): {anomaly_score:.4f}")
        
        # Apply noise normalization
        normalized_score = apply_noise_normalization(anomaly_score, request.snr)
        
        # Apply time-of-day compensation if hour provided
        if request.hour is not None:
            normalized_score = apply_time_compensation(normalized_score, request.hour)
        
        logger.info(f"Comparison complete: similarity={similarity:.4f}, anomaly={normalized_score:.4f}")
        
        return CompareResponse(
            score=normalized_score,
            raw_similarity=similarity,
            normalized=normalized_score,
            snr=request.snr
        )
        
    except Exception as e:
        logger.error(f"Error comparing embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare embeddings: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )

