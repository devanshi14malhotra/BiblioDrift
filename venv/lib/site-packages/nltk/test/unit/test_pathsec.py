import builtins
import io
import os
import socket
import zipfile
from urllib.error import HTTPError, URLError

import pytest

import nltk.downloader  # We will inspect this module directly
from nltk.downloader import Downloader


@pytest.fixture(autouse=True)
def enable_enforcement():
    """
    Dynamically toggle enforcement if pathsec exists.
    If on a branch without pathsec.py, proceed normally.
    """
    try:
        import nltk.pathsec

        original_enforce = nltk.pathsec.ENFORCE
        nltk.pathsec.ENFORCE = True
        yield
        nltk.pathsec.ENFORCE = original_enforce
    except ImportError:
        yield


# --- SSRF NETWORK TESTS ---


def test_valid_http_url():
    dl = Downloader(
        server_index_url="https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/index.xml"
    )
    try:
        dl.index()
    except URLError:
        pass


def test_ssrf_invalid_scheme():
    dl = Downloader(server_index_url="file:///etc/passwd")
    with pytest.raises((ValueError, PermissionError)):
        dl.index()


def test_ssrf_loopback_ip():
    dl = Downloader(server_index_url="http://127.0.0.1/admin")
    with pytest.raises((ValueError, PermissionError)):
        dl.index()


def test_ssrf_cloud_metadata_link_local():
    dl = Downloader(server_index_url="http://169.254.169.254/latest/meta-data/")
    with pytest.raises((ValueError, PermissionError)):
        dl.index()


def test_ssrf_ip_obfuscation():
    """Will FAIL on PR #3520 (on Unix) because string-matching misses the decimal IP."""
    dl = Downloader(server_index_url="http://2852039166/latest/meta-data/")
    try:
        dl.index()
        pytest.fail("Request succeeded entirely, bypassing all filters.")
    except (ValueError, PermissionError):
        # SUCCESS (Your Branch): Our sentinel proactively blocked the restricted IP.
        pass
    except HTTPError as e:
        # FAILURE (PR #3520): The request bypassed local filters and hit the network layer!
        pytest.fail(f"Vulnerability bypassed localized string filters: {e}")
    except URLError as e:
        # SUCCESS (Windows only): DNS resolution strictly fails on decimal IPs natively.
        if isinstance(e.reason, socket.gaierror):
            pass
        else:
            pytest.fail(f"Unexpected network failure: {e}")


# --- PATH TRAVERSAL TESTS ---


def test_path_traversal_absolute():
    """
    Test if absolute paths bypass standard relative traversal checks.
    Will FAIL on vulnerable branches because standard builtins.open does not check path boundaries.
    """
    try:
        from nltk.pathsec import open as target_open
    except ImportError:
        target_open = builtins.open

    # Cross-platform absolute path guaranteed outside all allowed roots.
    # Linux/macOS: /_nltk_pathsec_test/secret.txt
    # Windows:     C:\_nltk_pathsec_test\secret.txt
    outside = os.path.join(os.path.abspath(os.sep), "_nltk_pathsec_test", "secret.txt")
    with pytest.raises((ValueError, PermissionError)):
        target_open(outside, "r")


# --- ZIP-SLIP TESTS ---


def create_malicious_zip(filename):
    """Helper to create malicious zip files in memory."""
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, "w") as zf:
        zinfo = zipfile.ZipInfo(filename)
        zf.writestr(zinfo, b"malicious content")
    mem_zip.seek(0)
    return mem_zip


def test_zip_slip_traversal(tmp_path):
    """
    Test standard ../ Zip-Slip traversal.
    Will FAIL on PR #3520 because standard zipfile silently sanitizes/ignores
    the traversal rather than proactively blocking it and raising an alert.
    """
    # Dynamically grab the 'ZipFile' class NLTK's downloader is currently using
    TargetZipFile = getattr(nltk.downloader, "ZipFile", zipfile.ZipFile)

    malicious_zip = create_malicious_zip("../../../evil.sh")
    with pytest.raises((ValueError, PermissionError)):
        with TargetZipFile(malicious_zip, "r") as zf:
            zf.extractall(tmp_path)


def test_zip_slip_absolute_path(tmp_path):
    """
    Test Zip-Slip using an absolute path.
    Will FAIL on PR #3520 because standard zipfile silently ignores the absolute
    root rather than proactively raising a security alert.
    """
    TargetZipFile = getattr(nltk.downloader, "ZipFile", zipfile.ZipFile)

    malicious_zip = create_malicious_zip("/etc/cron.d/evil_cron")
    with pytest.raises((ValueError, PermissionError)):
        with TargetZipFile(malicious_zip, "r") as zf:
            zf.extractall(tmp_path)
