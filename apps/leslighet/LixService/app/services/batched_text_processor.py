import asyncio
from typing import List, Dict, Any, Tuple
import numpy as np
from concurrent.futures import ProcessPoolExecutor
import time

class BatchedTextProcessor:
    """
    Optimized text processor that uses batching and parallel processing
    for performance improvement when analyzing large texts.
    """
    
    def __init__(self, max_workers: int = None, chunk_size: int = 5000):
        """
        Initialize the batched text processor with configurable parallelism.
        
        Args:
            max_workers: Maximum number of worker processes (defaults to CPU count)
            chunk_size: Size of text chunks for batch processing
        """
        self._max_workers = max_workers
        self._chunk_size = chunk_size
        self._executor = ProcessPoolExecutor(max_workers=max_workers)
    
    def close(self):
        """Shutdown the process pool executor."""
        self._executor.shutdown()
    
    @staticmethod
    def _process_word_batch(words: List[str]) -> Dict[str, Any]:
        """
        Process a batch of words in parallel.
        
        Args:
            words: List of words to analyze
            
        Returns:
            Dictionary with word analysis statistics
        """
        # Word length statistics
        lengths = np.array([len(word) for word in words])
        
        # Calculate statistics efficiently using numpy
        return {
            'count': len(words),
            'avg_length': float(np.mean(lengths)) if lengths.size > 0 else 0,
            'max_length': int(np.max(lengths)) if lengths.size > 0 else 0,
            'min_length': int(np.min(lengths)) if lengths.size > 0 else 0,
            'long_words': int(np.sum(lengths > 6)),  # Words longer than 6 chars
            'long_words_percentage': float(np.sum(lengths > 6) / len(words) * 100) if len(words) > 0 else 0,
        }
    
    @staticmethod
    def _split_into_chunks(text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks of approximately equal size for parallel processing.
        
        Args:
            text: The text to split
            chunk_size: Target chunk size in characters
            
        Returns:
            List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]
        
        # Find appropriate split points (prefer splitting at paragraph breaks or sentences)
        chunks = []
        start = 0
        
        while start < len(text):
            # If we're near the end, just take the rest
            if start + chunk_size >= len(text):
                chunks.append(text[start:])
                break
            
            # Try to find a paragraph break
            end = min(start + chunk_size, len(text))
            split_point = text.rfind('\n\n', start, end)
            
            if split_point == -1 or (end - split_point) > chunk_size // 2:
                # No suitable paragraph break, try to find sentence break
                split_point = text.rfind('. ', start, end)
                
                if split_point == -1 or (end - split_point) > chunk_size // 3:
                    # No suitable sentence break, fall back to word boundary
                    split_point = text.rfind(' ', start, end)
                    
                    if split_point == -1:
                        # No suitable word boundary, just split at chunk_size
                        split_point = end - 1
                else:
                    # Include the period in this chunk
                    split_point += 1
            
            chunks.append(text[start:split_point + 1])
            start = split_point + 1
            
        return chunks
    
    async def process_words(self, text: str) -> Dict[str, Any]:
        """
        Process words in the text using batching and parallelization.
        
        Args:
            text: The text to process
            
        Returns:
            Dictionary with word analysis results
        """
        # Process in chunks to avoid memory issues with very large texts
        chunks = self._split_into_chunks(text, self._chunk_size)
        
        # Process each chunk
        words_by_chunk = [chunk.split() for chunk in chunks]
        
        # Process word batches in parallel
        loop = asyncio.get_event_loop()
        tasks = []
        
        for word_batch in words_by_chunk:
            tasks.append(
                loop.run_in_executor(
                    self._executor,
                    self._process_word_batch,
                    word_batch
                )
            )
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        # Combine results from all chunks
        all_words = []
        for words in words_by_chunk:
            all_words.extend(words)
        
        # Aggregate statistics
        total_word_count = sum(r['count'] for r in results)
        avg_word_length = (
            sum(r['avg_length'] * r['count'] for r in results) / total_word_count
            if total_word_count > 0 else 0
        )
        max_word_length = max(r['max_length'] for r in results) if results else 0
        min_word_length = min(r['min_length'] for r in results) if results else 0
        long_words_count = sum(r['long_words'] for r in results)
        long_words_percentage = (
            long_words_count / total_word_count * 100
            if total_word_count > 0 else 0
        )
        
        # Frequency analysis (limited to top N words for performance)
        word_freq = {}
        for words in words_by_chunk:
            for word in words:
                word_lower = word.lower()
                word_freq[word_lower] = word_freq.get(word_lower, 0) + 1
        
        # Get top words by frequency
        top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:100]
        
        return {
            'word_count': total_word_count,
            'unique_word_count': len(word_freq),
            'avg_word_length': avg_word_length,
            'max_word_length': max_word_length,
            'min_word_length': min_word_length,
            'long_words_count': long_words_count,
            'long_words_percentage': long_words_percentage,
            'frequency': {word: count for word, count in top_words},
            'lexical_diversity': len(word_freq) / total_word_count if total_word_count > 0 else 0,
            'processing_time_ms': 0  # Will be updated by the caller
        }
    
    async def process_sentences(self, text: str) -> Dict[str, Any]:
        """
        Process sentences in the text using batching and parallelization.
        
        Args:
            text: The text to process
            
        Returns:
            Dictionary with sentence analysis results
        """
        start_time = time.time()
        
        # Simple sentence splitting for demonstration
        # In a real implementation, use a more sophisticated NLP library
        sentences = []
        current_sentence = ""
        
        for char in text:
            current_sentence += char
            if char in ['.', '!', '?'] and current_sentence.strip():
                sentences.append(current_sentence.strip())
                current_sentence = ""
        
        # Add any remaining text as a sentence
        if current_sentence.strip():
            sentences.append(current_sentence.strip())
        
        # Process in batches
        batch_size = 500
        batches = [sentences[i:i + batch_size] for i in range(0, len(sentences), batch_size)]
        
        # Process sentence batches in parallel
        loop = asyncio.get_event_loop()
        tasks = []
        
        for batch in batches:
            tasks.append(
                loop.run_in_executor(
                    self._executor,
                    self._analyze_sentence_batch,
                    batch
                )
            )
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        # Combine results
        sentence_count = sum(r['count'] for r in results)
        avg_sentence_length = (
            sum(r['avg_length'] * r['count'] for r in results) / sentence_count
            if sentence_count > 0 else 0
        )
        max_sentence_length = max(r['max_length'] for r in results) if results else 0
        min_sentence_length = min(r['min_length'] for r in results) if results else 0
        
        return {
            'sentence_count': sentence_count,
            'avg_sentence_length': avg_sentence_length,
            'max_sentence_length': max_sentence_length,
            'min_sentence_length': min_sentence_length,
            'processing_time_ms': round((time.time() - start_time) * 1000, 2)
        }
    
    @staticmethod
    def _analyze_sentence_batch(sentences: List[str]) -> Dict[str, Any]:
        """
        Analyze a batch of sentences in parallel.
        
        Args:
            sentences: List of sentences to analyze
            
        Returns:
            Dictionary with sentence analysis statistics
        """
        # Calculate sentence length in words
        lengths = np.array([len(sentence.split()) for sentence in sentences])
        
        return {
            'count': len(sentences),
            'avg_length': float(np.mean(lengths)) if lengths.size > 0 else 0,
            'max_length': int(np.max(lengths)) if lengths.size > 0 else 0,
            'min_length': int(np.min(lengths)) if lengths.size > 0 else 0
        }