from dataclasses import dataclass
from uuid import uuid4


@dataclass
class PaymentResult:
    opaque_reference: str
    status: str


class PaymentProvider:
    code = "BASE"

    def create(self, idempotency_key: str, simulate_error: bool = False) -> PaymentResult:
        if simulate_error:
            return PaymentResult(opaque_reference=f"ERR-{idempotency_key}", status="FAILED")
        return PaymentResult(opaque_reference=f"{self.code}-{uuid4().hex[:16].upper()}", status="PENDING")


class MockMomoProvider(PaymentProvider):
    code = "MOCK_MOMO"


class MockOrangeMoneyProvider(PaymentProvider):
    code = "MOCK_ORANGE"


class MockBankProvider(PaymentProvider):
    code = "MOCK_BANK"


class MockCashDeskProvider(PaymentProvider):
    code = "MOCK_CASH"


PROVIDERS = {
    "MOCK_MOMO": MockMomoProvider(),
    "MOCK_ORANGE": MockOrangeMoneyProvider(),
    "MOCK_BANK": MockBankProvider(),
    "MOCK_CASH": MockCashDeskProvider(),
}
