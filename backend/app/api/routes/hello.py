from fastapi import APIRouter

router = APIRouter(prefix="/hello", tags=["hello"])


# 回傳 hello 測試訊息
@router.get("/", response_model=dict[str, str])
def hello_world() -> dict[str, str]:
    return {"message": "Hello, World!"}
