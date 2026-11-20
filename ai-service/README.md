# DECO embedding service

This local service converts Vietnamese search text into normalized 384-dimensional
embeddings. Express remains the public backend; the browser never calls this service
directly.

```powershell
cd ai-service
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The model is downloaded from Hugging Face on the first `/embed` request and then
cached locally. Check the service with `GET http://127.0.0.1:8000/health`.
