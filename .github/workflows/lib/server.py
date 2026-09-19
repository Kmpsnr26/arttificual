import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from openai import OpenAI

app = FastAPI(title="AURA Autonomous Agent Server")

# Izinkan akses dari aplikasi Flutter (Android / Windows / Web)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Konfigurasi Kunci API dari Environment
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

client_openai = OpenAI(api_key=OPENAI_KEY) if OPENAI_KEY else None

# Memori Belajar Sederhana (In-Memory / Persistent Store)
LONG_TERM_MEMORY = []

class AgentRequest(BaseModel):
    task: str
    user_context: str = ""

@app.get("/")
def health_check():
    return {"status": "online", "agent": "AURA Autonomous Neural Server"}

@app.post("/agent/think-and-browse")
async def autonomous_agent(req: AgentRequest):
    """
    Agen AI berpikir sendiri, mencari data terbaru di internet,
    dan belajar dari interaksi sebelumnya.
    """
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY belum dikonfigurasi di server.")

    try:
        # Menyiapkan riwayat pembelajaran
        memory_context = "\n".join(LONG_TERM_MEMORY[-5:]) if LONG_TERM_MEMORY else "Belum ada riwayat sebelumnya."

        system_instruction = f"""
Anda adalah AURA, Agen AI Otonom tingkat lanjut.
Anda memiliki kemampuan:
1. BERPIKIR SENDIRI: Analisis inti masalah pengguna langkah demi langkah.
2. MENJELAJAH INTERNET: Gunakan Google Search tool bawaan untuk memeriksa fakta/berita/data terbaru.
3. ADAPTIF & BELAJAR: Pertimbangkan riwayat memori pengalaman kerja sebelumnya:
{memory_context}

Format respon Anda:
- [Proses Berpikir]: Analisis singkat rencana tindakan Anda.
- [Temuan Internet]: Intisari fakta/data terverifikasi dari penjelajahan web.
- [Solusi/Tindakan]: Jawaban lengkap dan rekomendasi kerja nyata.
"""

        # Inisialisasi Model Gemini dengan Web Browsing Tool (Google Search Grounding)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools=[{"google_search_retrieval": {}}],
            system_instruction=system_instruction
        )

        response = model.generate_content(req.task)
        agent_answer = response.text

        # Pembelajaran Mandiri (Menyimpan insight penting ke memori jangka panjang)
        summary_insight = f"Tugas: {req.task[:50]}... -> Solusi tersimpan."
        LONG_TERM_MEMORY.append(summary_insight)

        return {
            "status": "success",
            "task": req.task,
            "response": agent_answer,
            "memory_retained": len(LONG_TERM_MEMORY)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
