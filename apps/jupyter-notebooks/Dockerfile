# Jupyter Data Science Environment
FROM jupyter/datascience-notebook:latest

USER root

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for JavaScript kernels
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

USER $NB_UID

# Install Python packages for AI/ML and graph databases
RUN pip install --no-cache-dir \
    python-arango \
    networkx \
    plotly \
    dash \
    streamlit \
    openai \
    anthropic \
    langchain \
    transformers \
    torch \
    sentence-transformers \
    scikit-learn \
    pandas \
    numpy \
    matplotlib \
    seaborn \
    jupyterlab-git

# Install JavaScript kernel
RUN npm install -g ijavascript
RUN ijsinstall

# Set working directory
WORKDIR /home/jovyan/work

# Copy notebook templates
COPY --chown=$NB_UID:$NB_GID apps/jupyter-notebooks/ ./

EXPOSE 8888

CMD ["start-notebook.sh", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root", "--NotebookApp.token=''", "--NotebookApp.password=''"]
