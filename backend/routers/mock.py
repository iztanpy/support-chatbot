from fastapi import APIRouter

router = APIRouter()

@router.get("/application_status")
def card_application_mock():
    return {
        "reference_number": 1,
        "status": "ok",
        "application_date": "2026-01-04",
        "estimated_completion": "2026-03-04",
    }

@router.get("/failed_status")
def failed_transaction_mock():
    return {
        "transaction_id": 1,
        "status": "failed",
        "amount": 100,
        "merchant": "SHEIN",
        "timestamp": "2026-01-04T12:00:00Z",
        "resolution": "Insufficient funds",
    }
