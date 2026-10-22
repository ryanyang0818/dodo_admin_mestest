from fastapi import APIRouter

router = APIRouter(prefix="/test", tags=["test"])


# 回傳測試用問候字串
@router.get("/hello")
def readHello() -> str:
    return "Hello"
