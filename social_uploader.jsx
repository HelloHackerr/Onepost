import { useState, useRef, useCallback } from "react";

const PLATFORM_INFO = {
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    bg: "#1a0000",
    icon: "▶",
    bestDays: ["Thursday", "Friday", "Saturday"],
    bestTime: "15:00",
    bestTimeLabel: "3:00 PM",
    timezone: "Your local time",
    maxTitle: 100,
    maxDesc: 5000,
  },
  facebook: {
    name: "Facebook",
    color: "#1877F2",
    bg: "#00061a",
    icon: "f",
    bestDays: ["Tuesday", "Wednesday", "Thursday"],
    bestTime: "13:00",
    bestTimeLabel: "1:00 PM",
    timezone: "Your local time",
    maxTitle: 255,
    maxDesc: 63206,
  },
  instagram: {
    name: "Instagram",
    color: "#E1306C",
    bg: "#1a0010",
    icon: "◉",
    bestDays: ["Monday", "Wednesday", "Friday"],
    bestTime: "11:00",
    bestTimeLabel: "11:00 AM",
    timezone: "Your local time",
    maxTitle: 150,
    maxDesc: 2200,
  },
};

function getNextBestDay(days) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (days.includes(dayNames[d.getDay()])) return d;
  }
  return new Date(today.setDate(today.getDate() + 1));
}

function formatSchedule(platform) {
  const info = PLATFORM_INFO[platform];
  const date = getNextBestDay(info.bestDays);
  const [h, m] = info.bestTime.split(":");
  date.setHours(parseInt(h), parseInt(m), 0, 0);
  return date;
}

const STEPS = ["Upload", "Platforms", "AI Generate", "Schedule", "Review"];

export default function App() {
  const [step, setStep] = useState(0);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [apiKey, setApiKey] = useState("");
  const [showApiInput, setShowApiInput] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) handleFile(file);
  }, []);

  const togglePlatform = (p) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generateAI = async () => {
    setLoading(true);
    const newResults = {};
    const newSchedules = {};

    for (const platform of platforms) {
      const info = PLATFORM_INFO[platform];
      const prompt = `You are a social media expert. Generate an optimized video title and description for ${info.name}.

Video filename: "${video?.name || "video"}"
Platform: ${info.name}
Max title length: ${info.maxTitle} characters
Max description length: ${info.maxDesc} characters

Requirements for ${info.name}:
${platform === "youtube" ? "- Include relevant keywords for SEO\n- Add hashtags at end\n- Include call to action\n- Add chapters if relevant" : ""}
${platform === "facebook" ? "- Conversational and engaging tone\n- Encourage shares and comments\n- Add relevant hashtags\n- Include emoji for engagement" : ""}
${platform === "instagram" ? "- Catchy and short caption\n- Heavy hashtag use (20-30 hashtags)\n- Emoji-rich\n- Call to action" : ""}

Respond ONLY in this JSON format (no markdown, no backticks):
{"title":"...","description":"..."}`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await res.json();
        const text = data.content?.map((c) => c.text || "").join("") || "";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        newResults[platform] = parsed;
      } catch {
        newResults[platform] = {
          title: `Amazing Video - Watch Now! 🎬`,
          description: `Check out this incredible video! Don't forget to like and share.\n\n#video #trending #viral`,
        };
      }

      const schedDate = formatSchedule(platform);
      newSchedules[platform] = schedDate.toISOString().slice(0, 16);
    }

    setResults(newResults);
    setSchedules(newSchedules);
    setLoading(false);
    setStep(3);
  };

  const handleUpload = async () => {
    const newStatus = {};
    for (const p of platforms) {
      newStatus[p] = "uploading";
    }
    setUploadStatus(newStatus);
    setStep(4);

    for (const p of platforms) {
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
      setUploadStatus((prev) => ({ ...prev, [p]: "scheduled" }));
    }
  };

  const reset = () => {
    setStep(0);
    setVideo(null);
    setVideoPreview(null);
    setPlatforms([]);
    setResults({});
    setSchedules({});
    setUploadStatus({});
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080810",
      color: "#f0f0f8",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "0 0 80px",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%)",
        borderBottom: "1px solid #ffffff15",
        padding: "20px 20px 16px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>
              <span style={{ color: "#a855f7" }}>⚡</span> OnePost
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>AI-Powered Social Uploader</div>
          </div>
          <button
            onClick={() => setShowApiInput(!showApiInput)}
            style={{
              background: "#ffffff10",
              border: "1px solid #ffffff20",
              color: "#aaa",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🔑 API Key
          </button>
        </div>

        {showApiInput && (
          <div style={{ marginTop: 12 }}>
            <input
              type="password"
              placeholder="Enter Claude API key (optional for demo)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%",
                background: "#ffffff08",
                border: "1px solid #ffffff20",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#fff",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 3,
                borderRadius: 2,
                background: i <= step ? "#a855f7" : "#ffffff15",
                transition: "background 0.3s",
                marginBottom: 4,
              }} />
              <div style={{
                fontSize: 9,
                color: i === step ? "#a855f7" : i < step ? "#666" : "#333",
                fontWeight: i === step ? 700 : 400,
              }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>

        {/* STEP 0 — Upload */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Select Your Video</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
              Upload once, post everywhere with AI-optimized content
            </p>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              style={{
                border: "2px dashed #a855f730",
                borderRadius: 16,
                padding: "40px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: video ? "#a855f708" : "#ffffff04",
                transition: "all 0.2s",
              }}
            >
              {videoPreview ? (
                <div>
                  <video
                    src={videoPreview}
                    style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }}
                    muted
                    playsInline
                  />
                  <div style={{ marginTop: 12, fontSize: 13, color: "#a855f7", fontWeight: 600 }}>
                    ✅ {video.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                    {(video.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Tap to select video</div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
                    MP4, MOV, AVI supported
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {video && (
              <button
                onClick={() => setStep(1)}
                style={{
                  width: "100%",
                  marginTop: 20,
                  padding: "16px",
                  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.3px",
                }}
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* STEP 1 — Platform Selection */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Choose Platforms</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
              AI will generate optimized content for each platform
            </p>

            {Object.entries(PLATFORM_INFO).map(([key, info]) => {
              const selected = platforms.includes(key);
              return (
                <div
                  key={key}
                  onClick={() => togglePlatform(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px",
                    borderRadius: 14,
                    marginBottom: 12,
                    border: `2px solid ${selected ? info.color : "#ffffff15"}`,
                    background: selected ? `${info.color}12` : "#ffffff05",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: info.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#fff",
                    flexShrink: 0,
                  }}>
                    {info.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{info.name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      Best time: {info.bestTimeLabel} · {info.bestDays.slice(0, 2).join(", ")}
                    </div>
                  </div>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `2px solid ${selected ? info.color : "#ffffff30"}`,
                    background: selected ? info.color : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: "#fff",
                  }}>
                    {selected ? "✓" : ""}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#ffffff10",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => { setStep(2); generateAI(); }}
                disabled={platforms.length === 0}
                style={{
                  flex: 2,
                  padding: "14px",
                  background: platforms.length > 0
                    ? "linear-gradient(135deg, #a855f7, #7c3aed)"
                    : "#ffffff15",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: platforms.length > 0 ? "pointer" : "not-allowed",
                }}
              >
                Generate with AI ✨
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Generating */}
        {step === 2 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 20, animation: "spin 2s linear infinite" }}>✨</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>AI is Working...</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 30 }}>
              Generating optimized content for {platforms.length} platform{platforms.length > 1 ? "s" : ""}
            </p>
            {platforms.map((p) => (
              <div key={p} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 10,
                background: "#ffffff08",
                marginBottom: 10,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: PLATFORM_INFO[p].color,
                  animation: "pulse 1s infinite",
                }} />
                <span style={{ fontSize: 14 }}>Optimizing for {PLATFORM_INFO[p].name}...</span>
              </div>
            ))}
            <style>{`
              @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
              @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            `}</style>
          </div>
        )}

        {/* STEP 3 — Schedule */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>AI Generated Content</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
              Review and edit titles, descriptions & schedules
            </p>

            {platforms.map((p) => {
              const info = PLATFORM_INFO[p];
              const result = results[p] || {};
              return (
                <div key={p} style={{
                  borderRadius: 14,
                  border: `1px solid ${info.color}40`,
                  background: `${info.color}08`,
                  marginBottom: 16,
                  overflow: "hidden",
                }}>
                  <div style={{
                    background: `${info.color}20`,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: info.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 900, color: "#fff",
                    }}>
                      {info.icon}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{info.name}</span>
                    <span style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      background: `${info.color}30`,
                      color: info.color,
                      padding: "3px 8px",
                      borderRadius: 20,
                      fontWeight: 600,
                    }}>
                      AI Optimized ✨
                    </span>
                  </div>

                  <div style={{ padding: 14 }}>
                    <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Title
                    </label>
                    <textarea
                      value={result.title || ""}
                      onChange={(e) => setResults((prev) => ({
                        ...prev,
                        [p]: { ...prev[p], title: e.target.value }
                      }))}
                      rows={2}
                      style={{
                        width: "100%", marginTop: 6,
                        background: "#ffffff08",
                        border: "1px solid #ffffff15",
                        borderRadius: 8,
                        padding: "10px",
                        color: "#fff",
                        fontSize: 13,
                        resize: "vertical",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />

                    <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginTop: 10 }}>
                      Description
                    </label>
                    <textarea
                      value={result.description || ""}
                      onChange={(e) => setResults((prev) => ({
                        ...prev,
                        [p]: { ...prev[p], description: e.target.value }
                      }))}
                      rows={4}
                      style={{
                        width: "100%", marginTop: 6,
                        background: "#ffffff08",
                        border: "1px solid #ffffff15",
                        borderRadius: 8,
                        padding: "10px",
                        color: "#fff",
                        fontSize: 12,
                        resize: "vertical",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />

                    <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginTop: 10 }}>
                      📅 Scheduled Time (AI Recommended)
                    </label>
                    <input
                      type="datetime-local"
                      value={schedules[p] || ""}
                      onChange={(e) => setSchedules((prev) => ({ ...prev, [p]: e.target.value }))}
                      style={{
                        width: "100%", marginTop: 6,
                        background: "#ffffff08",
                        border: `1px solid ${info.color}40`,
                        borderRadius: 8,
                        padding: "10px",
                        color: "#fff",
                        fontSize: 13,
                        boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                    />
                    <div style={{ fontSize: 11, color: info.color, marginTop: 4 }}>
                      ⚡ Best days: {info.bestDays.join(", ")} at {info.bestTimeLabel}
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: "14px",
                  background: "#ffffff10", color: "#fff",
                  border: "none", borderRadius: 12,
                  fontSize: 15, cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleUpload}
                style={{
                  flex: 2, padding: "14px",
                  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                  color: "#fff", border: "none",
                  borderRadius: 12, fontSize: 15,
                  fontWeight: 700, cursor: "pointer",
                }}
              >
                🚀 Schedule Upload
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Done */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", paddingTop: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 56 }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>All Scheduled!</h2>
              <p style={{ color: "#888", fontSize: 14 }}>
                Your video will be posted at the best times for each platform
              </p>
            </div>

            {platforms.map((p) => {
              const info = PLATFORM_INFO[p];
              const status = uploadStatus[p];
              const schedTime = schedules[p] ? new Date(schedules[p]) : null;
              return (
                <div key={p} style={{
                  padding: "16px",
                  borderRadius: 14,
                  border: `1px solid ${status === "scheduled" ? info.color : "#ffffff15"}40`,
                  background: status === "scheduled" ? `${info.color}10` : "#ffffff05",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: info.color,
                    display: "flex", alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18, fontWeight: 900, color: "#fff",
                  }}>
                    {info.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{info.name}</div>
                    {schedTime && (
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                        📅 {schedTime.toLocaleDateString()} at {schedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 20 }}>
                    {status === "uploading" ? "⏳" : "✅"}
                  </div>
                </div>
              );
            })}

            <div style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#a855f710",
              border: "1px solid #a855f730",
              fontSize: 13,
              color: "#c084fc",
              lineHeight: 1.6,
            }}>
              <strong>ℹ️ Note:</strong> To actually upload to YouTube, Facebook & Instagram, you need to connect API keys in the settings. This demo shows the scheduling workflow.
            </div>

            <button
              onClick={reset}
              style={{
                width: "100%", marginTop: 16,
                padding: "16px",
                background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                color: "#fff", border: "none",
                borderRadius: 12, fontSize: 16,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              + Upload Another Video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
