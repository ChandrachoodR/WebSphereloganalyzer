# 🧩 WebSphere Log Analyzer

### Overview
A Flask-based tool that allows users to upload IBM WebSphere Liberty `messages.log`, view logs visually, filter by severity, and get AI-based explanations for errors using **Google Gemini API**.

---

## 🚀 Features
- Upload and parse `messages.log`
- View structured logs with color-coded severities
- Filter by INFO, WARN, ERROR, FATAL
- Click any log line to get **AI explanation** powered by Gemini
- Simple and clean web UI using TailwindCSS

---

## 🧱 Tech Stack
| Layer | Technology |
|-------|-------------|
| Frontend | HTML, TailwindCSS, JavaScript |
| Backend | Flask (Python) |
| AI Integration | Google Gemini API |
| Log Parsing | Python Regex & Datetime Parser |

---

## ⚙️ Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/websphere-log-analyzer.git
cd websphere-log-analyzer
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Add Google Gemini API Key

Create a `.env` file:

```
GEMINI_API_KEY=your_api_key_here
# Optional: override the default Gemini model.
# The app automatically tries both `gemini-2.5-flash` and `models/gemini-2.5-flash`
# so it works with either the v1beta or v1 Gemini endpoints.
GEMINI_MODEL=models/gemini-2.5-flash
```

### 4. Run the App

```bash
python app.py
```

Visit [http://localhost:5000](http://localhost:5000)

---

## 🚀 Deploy to Google Cloud Run

1. **Build and push the image**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/websphere-log-analyser
   ```
2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy websphere-log-analyser \
     --image gcr.io/PROJECT_ID/websphere-log-analyser \
     --region YOUR_REGION \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY=your_api_key_here,GEMINI_MODEL=gemini-2.5-flash
   ```
3. Cloud Run automatically sets the `PORT`. The container uses Gunicorn (`app:app`) with two workers, so scale is managed via Cloud Run revisions. Use `--set-secrets` or Secret Manager for sensitive values in production.

---

## 🧩 File Structure

```
websphere-log-analyzer/
│
├── app.py                # Flask backend
├── templates/
│   └── index.html        # Frontend UI
├── static/
│   ├── style.css         # Tailwind styles
│   └── script.js         # Filtering logic
├── parser/
│   └── log_parser.py     # Parses WebSphere logs
├── requirements.txt
└── README.md
```

---

## 💡 How It Works

1. Upload your `messages.log`
2. The Flask server parses the file and sends structured JSON to the frontend
3. Logs are displayed in a color-coded table
4. Click an error and press “Explain with AI”
5. Gemini API explains the issue in plain English

---

## 🧠 Example Prompt

```python
prompt = """
Explain the following WebSphere Liberty log error and provide possible root causes and fixes:

[7/20/24, 18:30:02:345 IST] 00000067 Servlet E com.ibm.ws.webcontainer.servlet.ServletWrapper  SRVE0293E: [Servlet Error]...
"""
```

Gemini will respond with:

> This error indicates that the servlet threw an exception during execution. Common causes include missing resources, null references, or classpath issues. Check the application code and ensure dependencies are loaded.

---

## 📈 Future Enhancements

* Timeline visualization of log errors
* AI-based root cause classification
* Export report to PDF/CSV
* Integration with CI/CD log pipelines

---

## 👨‍💻 Author

**Chandrachood Raveendran**  
SRE | Product Manager | AI Innovator  
Building intelligent tools for enterprise observability
