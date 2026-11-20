import os
import threading
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
EXPECTED_DIMENSION = 384

app = FastAPI(title="DECO embedding service", version="1.0.0")
_model = None
_model_lock = threading.Lock()


class EmbedRequest(BaseModel):
    texts: Annotated[list[str], Field(min_length=1, max_length=64)]


class EmbedResponse(BaseModel):
    model: str
    dimension: int
    embeddings: list[list[float]]


def get_model():
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as error:
                raise RuntimeError(
                    "Chưa cài sentence-transformers. Chạy: pip install -r requirements.txt"
                ) from error
            _model = SentenceTransformer(MODEL_NAME)
    return _model


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "dimension": EXPECTED_DIMENSION,
        "loaded": _model is not None,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(payload: EmbedRequest):
    texts = [text.strip() for text in payload.texts]
    if any(not text for text in texts):
        raise HTTPException(status_code=400, detail="Nội dung cần embedding không được trống.")
    if any(len(text) > 4000 for text in texts):
        raise HTTPException(status_code=400, detail="Mỗi nội dung tối đa 4.000 ký tự.")

    try:
        vectors = get_model().encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Không thể tạo embedding: {error}") from error

    if vectors.shape[1] != EXPECTED_DIMENSION:
        raise HTTPException(
            status_code=500,
            detail=f"Model trả về {vectors.shape[1]} chiều, cần {EXPECTED_DIMENSION} chiều.",
        )

    return EmbedResponse(
        model=MODEL_NAME,
        dimension=EXPECTED_DIMENSION,
        embeddings=vectors.astype(float).tolist(),
    )
