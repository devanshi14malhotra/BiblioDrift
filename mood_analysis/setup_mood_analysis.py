#!/usr/bin/env python3
"""
Setup script for BiblioDrift GoodReads Mood Analysis feature
Installs dependencies and sets up the environment
"""

import subprocess
import sys
import os

def run_command(command_list, description):
    """Run a command and handle errors."""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command_list, check=True, capture_output=True, text=True)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print("✗ Python 3.7 or higher is required")
        return False
    print(f"✓ Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def install_dependencies():
    """Install Python dependencies."""
    dependencies = [
        "flask==2.3.3",
        "flask-cors==4.0.0", 
        "vaderSentiment==3.3.2",
        "textblob==0.17.1",
        "requests==2.31.0",
        "beautifulsoup4==4.12.2",
        "lxml==4.9.3",
        "numpy==1.24.3"
    ]
    
    print("\nInstalling Python dependencies...")
    
    for dep in dependencies:
        package_name = dep.split('==')[0]
        if not run_command(['pip', 'install', dep], f"Installing {package_name}"):
            return False
    
    return True

def download_textblob_corpora():
    """Download required TextBlob corpora."""
    print("\nDownloading TextBlob corpora...")
    try:
        import textblob
        textblob.download_corpora()
        print("✓ TextBlob corpora downloaded")
        return True
    except Exception as e:
        print(f"✗ Failed to download TextBlob corpora: {e}")
        return False

def create_cache_directory():
    """Create cache directory for mood analyses."""
    cache_dir = "mood_cache"
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        print(f"✓ Created cache directory: {cache_dir}")
    else:
        print(f"✓ Cache directory already exists: {cache_dir}")
    return True

def test_installation():
    """Test if the installation works."""
    print("\nTesting installation...")
    
    try:
        # Test imports
        import flask
        import vaderSentiment
        import textblob
        import requests
        import bs4
        print("✓ All required packages imported successfully")
        
        # Test basic functionality
        from mood_analysis.mood_analyzer import BookMoodAnalyzer
        analyzer = BookMoodAnalyzer()
        
        test_review = [{
            'text': 'This is a test review to check if the mood analyzer works correctly.',
            'rating': 4
        }]
        
        result = analyzer.determine_primary_mood(test_review)
        if 'bibliodrift_vibe' in result:
            print("✓ Mood analyzer working correctly")
            return True
        else:
            print("✗ Mood analyzer test failed")
            return False
            
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False
    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False

def main():
    """Main setup function."""
    print("BiblioDrift GoodReads Mood Analysis - Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("\n✗ Failed to install dependencies")
        sys.exit(1)
    
    # Download TextBlob corpora
    if not download_textblob_corpora():
        print("\n⚠ TextBlob corpora download failed, but continuing...")
    
    # Create cache directory
    create_cache_directory()
    
    # Test installation
    if not test_installation():
        print("\n✗ Installation test failed")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✓ Setup completed successfully!")
    print("\nNext steps:")
    print("1. Run the test suite: python test_mood_analysis.py")
    print("2. Start the Flask server: python app.py")
    print("3. Open index.html in your browser to test the frontend")
    print("\nAPI Endpoints available at http://localhost:5000:")
    print("- POST /api/v1/analyze-mood")
    print("- POST /api/v1/mood-tags") 
    print("- POST /api/v1/generate-note")
    print("- GET  /api/v1/health")

if __name__ == "__main__":
    main()