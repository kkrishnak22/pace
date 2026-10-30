// d:\pace\client\js\api.js

const API_BASE = window.location.origin;

const LessonAPI = {
  async fetchManifest() {
    try {
      const res = await fetch(`${API_BASE}/api/lesson/manifest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error('[LessonAPI] fetchManifest failed:', err);
      return null;
    }
  },

  async fetchStep(stepNumber) {
    try {
      const res = await fetch(`${API_BASE}/api/lesson/step/${stepNumber}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error(`[LessonAPI] fetchStep ${stepNumber} failed:`, err);
      return null;
    }
  },

  async generateStep(stepNumber, language = 'en') {
    try {
      console.log(`[LessonAPI] POST /api/lesson/generate-step for Step ${stepNumber}...`);
      const res = await fetch(`${API_BASE}/api/lesson/generate-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: 'java-memory',
          stepNumber: stepNumber,
          language: language
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error(`[LessonAPI] generateStep ${stepNumber} failed:`, err);
      return null;
    }
  }
};

window.LessonAPI = LessonAPI;

