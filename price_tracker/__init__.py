"""
Price Tracker Module
Tracks book prices across different retailers and alerts users when prices drop.
"""

from .price_tracker import PriceTracker, get_price_tracker

__all__ = ['PriceTracker', 'get_price_tracker']
