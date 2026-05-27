"""Utility script for manually checking configured rate-limit constants.

This file lives under `scratch/` and is not intended to be collected by pytest.
"""

__test__ = False


def main() -> None:
	from backend.app import RATE_LIMIT_WINDOW, RATE_LIMIT_MAX_REQUESTS

	print(f"RATE_LIMIT_WINDOW: {RATE_LIMIT_WINDOW}")
	print(f"RATE_LIMIT_MAX_REQUESTS: {RATE_LIMIT_MAX_REQUESTS}")


if __name__ == "__main__":
	main()
