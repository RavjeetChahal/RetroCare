"""
Audio processing utilities for voice embedding extraction.
Uses SpeechBrain's ECAPA-TDNN model for speaker verification.
"""
import numpy as np
import librosa
import aiohttp
import io
from typing import Tuple
from speechbrain.inference.speaker import EncoderClassifier
import logging

logger = logging.getLogger(__name__)

# Global model instance (loaded on startup)
_model = None
_model_loaded = False


def load_model():
    """Load ECAPA-TDNN model globally for performance."""
    global _model, _model_loaded
    if _model_loaded:
        return _model
    
    try:
        logger.info("Loading ECAPA-TDNN model...")
        _model = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="models/ecapa",
            run_opts={"device": "cpu"}  # Use CPU by default, can switch to "cuda" if available
        )
        _model_loaded = True
        logger.info("ECAPA-TDNN model loaded successfully")
        return _model
    except Exception as e:
        logger.error(f"Failed to load ECAPA-TDNN model: {e}")
        raise


async def load_audio_from_url(url: str, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Download and load audio from URL.
    
    Args:
        url: URL to audio file
        target_sr: Target sample rate (default 16000 Hz)
    
    Returns:
        Tuple of (waveform, sample_rate)
    """
    import asyncio
    
    try:
        # Create timeout for the entire operation (60 seconds)
        timeout = aiohttp.ClientTimeout(total=60, connect=10)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            logger.info(f"Downloading audio from: {url}")
            async with session.get(url) as response:
                if response.status != 200:
                    raise ValueError(f"Failed to download audio: HTTP {response.status}")
                
                # Limit audio file size to 50MB to prevent memory issues
                max_size = 50 * 1024 * 1024  # 50MB
                audio_bytes = await response.read()
                
                if len(audio_bytes) > max_size:
                    raise ValueError(f"Audio file too large: {len(audio_bytes)} bytes (max {max_size})")
                
                logger.info(f"Downloaded {len(audio_bytes)} bytes, loading audio...")
                audio_io = io.BytesIO(audio_bytes)
                
                # Load audio with librosa (limit to 5 minutes of audio to prevent long processing)
                max_duration = 300  # 5 minutes
                waveform, sample_rate = librosa.load(
                    audio_io,
                    sr=target_sr,
                    mono=True,
                    duration=max_duration  # Limit duration to prevent hangs
                )
                
                logger.info(f"Loaded audio: {len(waveform)} samples at {sample_rate} Hz ({len(waveform)/sample_rate:.1f}s)")
                return waveform, sample_rate
                
    except asyncio.TimeoutError:
        error_msg = f"Timeout downloading audio from {url} (exceeded 60 seconds)"
        logger.error(error_msg)
        raise ValueError(error_msg)
    except aiohttp.ClientError as e:
        error_msg = f"Network error downloading audio: {e}"
        logger.error(error_msg)
        raise ValueError(error_msg)
    except Exception as e:
        logger.error(f"Error loading audio from URL: {e}", exc_info=True)
        raise


def get_embedding(audio_waveform: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """
    Extract voice embedding from audio waveform using ECAPA-TDNN.
    
    Args:
        audio_waveform: Audio signal as numpy array
        sample_rate: Sample rate of the audio (should be 16000 Hz)
    
    Returns:
        192-dimensional embedding vector (normalized)
    """
    if not _model_loaded:
        load_model()
    
    try:
        # Ensure audio is the right shape for SpeechBrain
        # SpeechBrain expects (batch, time) or (time,)
        if len(audio_waveform.shape) == 1:
            # Add batch dimension: (1, time)
            audio_tensor = np.expand_dims(audio_waveform, axis=0)
        else:
            audio_tensor = audio_waveform
        
        # Extract embedding
        # The model returns embeddings of shape (batch, embedding_dim)
        embeddings = _model.encode_batch(audio_tensor)
        
        # Convert to numpy and remove batch dimension
        embedding = embeddings.squeeze().cpu().numpy()
        
        # Normalize embedding to unit length
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        logger.info(f"Extracted embedding: shape {embedding.shape}, norm {np.linalg.norm(embedding):.4f}")
        return embedding
        
    except Exception as e:
        logger.error(f"Error extracting embedding: {e}")
        raise


def compute_snr(audio: np.ndarray, sample_rate: int = 16000) -> float:
    """
    Compute signal-to-noise ratio (SNR) in dB.
    
    Uses spectral subtraction method to estimate noise floor.
    
    Args:
        audio: Audio signal as numpy array
        sample_rate: Sample rate of the audio
    
    Returns:
        SNR value in dB (typically 0-30 dB, higher is better)
    """
    try:
        # Compute short-time Fourier transform
        stft = librosa.stft(audio, hop_length=512, n_fft=2048)
        magnitude = np.abs(stft)
        
        # Estimate noise floor from quiet segments
        # Use bottom 20% of magnitude values as noise estimate
        magnitude_flat = magnitude.flatten()
        noise_threshold = np.percentile(magnitude_flat, 20)
        noise_power = np.mean(magnitude_flat[magnitude_flat <= noise_threshold] ** 2)
        
        # Estimate signal power from all segments
        signal_power = np.mean(magnitude ** 2)
        
        # Avoid division by zero
        if noise_power < 1e-10:
            noise_power = 1e-10
        
        # Compute SNR in dB
        snr_linear = signal_power / noise_power
        snr_db = 10 * np.log10(snr_linear)
        
        # Clamp to reasonable range
        snr_db = max(0.0, min(30.0, snr_db))
        
        logger.debug(f"Computed SNR: {snr_db:.2f} dB")
        return float(snr_db)
        
    except Exception as e:
        logger.warning(f"Error computing SNR, using default: {e}")
        # Return a default moderate SNR if computation fails
        return 15.0

