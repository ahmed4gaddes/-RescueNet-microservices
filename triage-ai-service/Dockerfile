# triage-ai-service (Python / FastAPI / scikit-learn / MySQL)
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app app
COPY train_model.py .
# Le modèle (.joblib) n'est pas versionné : on l'entraîne à la construction de l'image
RUN python train_model.py
EXPOSE 8083
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
