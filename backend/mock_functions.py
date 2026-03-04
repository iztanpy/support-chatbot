import asyncio
import random
from datetime import datetime, timedelta

async def get_application_status(customer_id: str) -> dict:
    """
    Mock function to retrieve card application status.
    Replace this with a real API call in production.
    """
    await asyncio.sleep(0.5)  # Simulate network latency

    statuses = ["Under Review", "Approved", "Pending Documents", "Rejected"]
    status = random.choice(statuses)

    app_date = datetime.now() - timedelta(days=random.randint(1, 30))
    est_completion = app_date + timedelta(days=14)

    return {
        "customer_id": customer_id,
        "reference_number": f"APP-{random.randint(100000, 999999)}",
        "status": status,
        "application_date": app_date.strftime("%Y-%m-%d"),
        "estimated_completion": est_completion.strftime("%Y-%m-%d"),
        "notes": _status_note(status)
    }

async def get_transaction_status(transaction_id: str) -> dict:
    """
    Mock function to retrieve failed transaction details.
    Replace this with a real API call in production.
    """
    await asyncio.sleep(0.4)

    failure_reasons = [
        ("Insufficient Funds", "Please ensure your account has sufficient balance before retrying."),
        ("Card Blocked", "Your card has been temporarily blocked. Please contact support to unblock."),
        ("Merchant Declined", "The merchant declined the transaction. Please contact the merchant directly."),
        ("System Timeout", "The transaction timed out. Please retry after a few minutes."),
        ("Invalid CVV", "CVV validation failed. Check your card details and retry."),
    ]
    reason, resolution = random.choice(failure_reasons)

    tx_time = datetime.now() - timedelta(minutes=random.randint(5, 1440))

    return {
        "transaction_id": transaction_id,
        "status": f"Declined – {reason}",
        "failure_reason": reason,
        "amount": f"₱{random.uniform(100, 10000):.2f}",
        "merchant": random.choice(["Shopee PH", "Lazada", "GrabFood", "Foodpanda", "SM Online"]),
        "timestamp": tx_time.strftime("%Y-%m-%d %H:%M:%S"),
        "resolution": resolution
    }

def _status_note(status: str) -> str:
    notes = {
        "Under Review": "Our team is reviewing your application. You will receive an update within 3-5 business days.",
        "Approved": "Congratulations! Your card is being processed and will be delivered within 7-10 business days.",
        "Pending Documents": "Please submit the required documents via the Atome app to continue processing.",
        "Rejected": "We regret to inform you that your application did not meet our current criteria. You may reapply after 90 days.",
    }
    return notes.get(status, "")
