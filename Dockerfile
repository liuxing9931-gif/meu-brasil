FROM python:3.12-slim
WORKDIR /app
COPY server.py index.html style.css data.js core.js app.js buddy.js reading-data.js reading-vocabulary.js dictionary.js lexicon.js reading.js sw.js manifest.webmanifest icon.svg icon-192.png icon-512.png ./
COPY dictionary/ ./dictionary/
COPY tools/build_dictionary.py ./tools/build_dictionary.py
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["python3", "server.py", "--host", "0.0.0.0"]
