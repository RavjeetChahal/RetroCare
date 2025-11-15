"""
Similarity and anomaly scoring utilities.
Converts embeddings to anomaly scores with optional normalization.
"""
import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


def cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """
    Compute cosine similarity between two embeddings.
    
    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector
    
    Returns:
        Cosine similarity value between -1 and 1 (typically 0 to 1 for normalized embeddings)
    """
    try:
        # Ensure embeddings are numpy arrays
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)
        
        # Check dimensions match
        if emb1.shape != emb2.shape:
            raise ValueError(f"Embedding shapes don't match: {emb1.shape} vs {emb2.shape}")
        
        # Compute dot product
        dot_product = np.dot(emb1, emb2)
        
        # Compute norms
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        # Avoid division by zero
        if norm1 == 0 or norm2 == 0:
            logger.warning("Zero norm embedding detected")
            return 0.0
        
        # Cosine similarity
        similarity = dot_product / (norm1 * norm2)
        
        # Clamp to [-1, 1] range
        similarity = max(-1.0, min(1.0, similarity))
        
        return float(similarity)
        
    except Exception as e:
        logger.error(f"Error computing cosine similarity: {e}")
        raise


def similarity_to_anomaly(similarity: float) -> float:
    """
    Convert cosine similarity to anomaly score.
    
    Args:
        similarity: Cosine similarity (1.0 = identical, 0.0 = orthogonal, -1.0 = opposite)
    
    Returns:
        Anomaly score from 0.0 (normal/identical) to 1.0 (very different)
    """
    # For normalized embeddings, similarity is typically in [0, 1]
    # Anomaly = 1 - similarity
    anomaly = 1.0 - similarity
    
    # Clamp to [0, 1] range
    return max(0.0, min(1.0, anomaly))


def apply_noise_normalization(anomaly_score: float, snr: float) -> float:
    """
    Adjust anomaly score based on signal quality.
    
    Low SNR (noisy audio) can cause false positives, so we reduce
    the anomaly score to account for noise-induced differences.
    
    Args:
        anomaly_score: Raw anomaly score (0.0 to 1.0)
        snr: Signal-to-noise ratio in dB (0-30, higher is better)
    
    Returns:
        Normalized anomaly score
    """
    # If SNR is low (< 15 dB), reduce anomaly score
    # Reduction factor: 15-25% depending on how bad the SNR is
    if snr < 15.0:
        # Linear reduction: worse SNR = more reduction
        # At SNR=0: reduce by 25%
        # At SNR=15: reduce by 0%
        reduction_factor = 0.25 * (15.0 - snr) / 15.0
        reduction = anomaly_score * reduction_factor
        normalized = anomaly_score - reduction
        
        logger.debug(f"SNR normalization: SNR={snr:.2f}dB, reduction={reduction:.4f}, score={anomaly_score:.4f} -> {normalized:.4f}")
        return max(0.0, normalized)
    
    return anomaly_score


def apply_time_compensation(anomaly_score: float, hour: Optional[int] = None) -> float:
    """
    Adjust for natural voice variations by time of day.
    
    Voices may naturally differ in morning vs evening due to:
    - Sleep/wake cycles
    - Vocal cord state
    - Energy levels
    
    Args:
        anomaly_score: Current anomaly score
        hour: Hour of day (0-23), None to skip compensation
    
    Returns:
        Time-compensated anomaly score
    """
    if hour is None:
        return anomaly_score
    
    # Morning window: 6-9 AM (voices may be lower/deeper)
    # Evening window: 6-9 PM (voices may be tired)
    # Reduce anomaly by 5-10% during these windows
    
    if 6 <= hour <= 9:  # Morning
        reduction = anomaly_score * 0.08  # 8% reduction
        compensated = anomaly_score - reduction
        logger.debug(f"Morning compensation: hour={hour}, score={anomaly_score:.4f} -> {compensated:.4f}")
        return max(0.0, compensated)
    
    if 18 <= hour <= 21:  # Evening
        reduction = anomaly_score * 0.06  # 6% reduction
        compensated = anomaly_score - reduction
        logger.debug(f"Evening compensation: hour={hour}, score={anomaly_score:.4f} -> {compensated:.4f}")
        return max(0.0, compensated)
    
    return anomaly_score


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """
    Average multiple embeddings for more stable baseline.
    
    Useful for creating a baseline from multiple samples.
    
    Args:
        embeddings: List of embedding vectors
    
    Returns:
        Averaged embedding vector (normalized)
    """
    if not embeddings:
        raise ValueError("Cannot average empty list of embeddings")
    
    # Convert to numpy array
    emb_array = np.array(embeddings)
    
    # Average along first axis
    averaged = np.mean(emb_array, axis=0)
    
    # Normalize to unit length
    norm = np.linalg.norm(averaged)
    if norm > 0:
        averaged = averaged / norm
    
    return averaged

