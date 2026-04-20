import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ───
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";
const YOUTUBE_CHANNEL_HANDLE = import.meta.env.VITE_YOUTUBE_CHANNEL_HANDLE || "";


const MOODS = ["All", "Dark", "Epic", "Chill", "Aggressive", "Energetic", "Sad", "Hopeful"];

const MOOD_COLORS = {
  Dark:       { bg: "rgba(108,92,231,0.12)",  text: "#a29bfe", dot: "#a29bfe" },
  Epic:       { bg: "rgba(225,112,85,0.12)",  text: "#e67e39", dot: "#e67e39" },
  Chill:      { bg: "rgba(0,184,148,0.12)",   text: "#00e5a0", dot: "#00e5a0" },
  Aggressive: { bg: "rgba(214,48,49,0.12)",   text: "#ff6b6b", dot: "#ff6b6b" },
  Energetic:  { bg: "rgba(253,203,110,0.12)", text: "#fdcb6e", dot: "#fdcb6e" },
  Sad:        { bg: "rgba(116,185,255,0.12)", text: "#74b9ff", dot: "#74b9ff" },
  Hopeful:    { bg: "rgba(255,255,255,0.07)", text: "#e8e8f0", dot: "#e8e8f0" },
};

const MOOD_ACCENT = {
  Dark:       { color: "#a29bfe", subtle: "rgba(162,155,254,0.08)" },
  Epic:       { color: "#e67e39", subtle: "rgba(230,126,57,0.08)" },
  Chill:      { color: "#00e5a0", subtle: "rgba(0,229,160,0.08)" },
  Aggressive: { color: "#ff6b6b", subtle: "rgba(255,107,107,0.08)" },
  Energetic:  { color: "#fdcb6e", subtle: "rgba(253,203,110,0.08)" },
  Sad:        { color: "#74b9ff", subtle: "rgba(116,185,255,0.08)" },
  Hopeful:    { color: "#e8e8f0", subtle: "rgba(232,232,240,0.08)" },
};
const DEFAULT_ACCENT = { color: "#00e5a0", subtle: "rgba(0,229,160,0.08)" };

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatCount(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Supabase helper (lightweight, no SDK needed) ───
async function supabaseFetch(table, params = "") {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error("Supabase fetch failed");
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// VISUALIZER COMPONENT — bottom player waveform
// ═══════════════════════════════════════════════
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function Visualizer({ analyser, isPlaying, accent }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const barsRef = useRef(new Float32Array(64).fill(0));
  const accentRef = useRef(accent);
  useEffect(() => { accentRef.current = accent; }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
    }
    resize();
    window.addEventListener("resize", resize);

    const halfCount = 64;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);

    function draw() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barW = w / (halfCount * 2);
      const rgb = hexToRgb(accentRef.current || "#00e5a0");

      const drawBar = (x, y, barH) => {
        const grad = ctx.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, `rgba(${rgb}, 0.5)`);
        grad.addColorStop(1, `rgba(${rgb}, 0.03)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y, barW - 2, barH);
      };

      for (let i = 0; i < halfCount; i++) {
        let target;
        if (analyser && isPlaying) {
          const idx = Math.floor((i / halfCount) * dataArray.length);
          target = dataArray[idx] / 255;
        } else {
          target = (Math.sin(Date.now() * 0.0015 + i * 0.3) * 0.5 + 0.5) *
                   (Math.sin(Date.now() * 0.004 + i * 0.1) * 0.3 + 0.7) * 0.25;
        }
        barsRef.current[i] += (target - barsRef.current[i]) * 0.12;

        const barH = barsRef.current[i] * h * 0.85;
        const y = h - barH;

        drawBar(w / 2 + i * barW, y, barH);           // right side
        drawBar(w / 2 - (i + 1) * barW, y, barH);     // left side (mirror)
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, isPlaying]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35, pointerEvents: "none" }} />;
}

// ═══════════════════════════════════════════════
// DOWNLOAD MODAL — ad → credit → download
// ═══════════════════════════════════════════════
function DownloadModal({ track, onClose, adBlocked }) {
  const [step, setStep] = useState("ad");
  const [countdown, setCountdown] = useState(5);
  const [copied, setCopied] = useState(false);
  const accent = MOOD_ACCENT[track?.mood]?.color || DEFAULT_ACCENT.color;

  useEffect(() => {
    if (step !== "ad") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "ad") return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, [step]);

  if (!track) return null;

  const creditText = `Track: ${track.artist} - ${track.title}\nMusic provided by SafeMusicLibrary.\nFind more copyright free music:\nyoutube.com/@safemusiclibrary`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(creditText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`${R2_PUBLIC_URL}/${track.filename}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = track.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(`${R2_PUBLIC_URL}/${track.filename}`, "_blank");
    }
    // Increment download count via Supabase RPC (fire-and-forget)
    fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_download_count`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ track_id: track.id }),
    }).catch(() => {});
    onClose();
  };

  return (
    <div onClick={onClose} style={styles.modalOverlay}>
      <div onClick={e => e.stopPropagation()} style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={styles.modalIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Download Track</span>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.modalTrackName}>{track.artist} — {track.title}</div>

          {step === "ad" && (
            <div>
              <div style={styles.adSupportMsg}>
                <strong style={{ color: "#eaeaf0" }}>Thanks for supporting SafeMusicLibrary!</strong><br />
                Watching this short ad helps us keep all our music 100% free for creators like you.
              </div>
              {adBlocked ? (
                <div style={{ width: "100%", minHeight: 180, marginBottom: 16, background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7a7a8e" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style={{ color: "#eaeaf0", fontWeight: 600, fontSize: 14 }}>Ad blocker detected</div>
                  <div style={{ color: "#7a7a8e", fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>
                    Ads keep SafeMusicLibrary free. Please whitelist this site in your ad blocker, then reopen the download.
                  </div>
                </div>
              ) : (
                <div style={{ width: "100%", minHeight: 180, marginBottom: 16 }}>
                  <ins className="adsbygoogle"
                    style={{ display: "block" }}
                    data-ad-client="ca-pub-3266340486490318"
                    data-ad-slot="2269245778"
                    data-ad-format="auto"
                    data-full-width-responsive="true" />
                </div>
              )}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ ...styles.timerCircle, borderColor: countdown === 0 ? "var(--accent)" : undefined }}>
                  {countdown === 0 ? "✓" : countdown}
                </div>
              </div>
              <button
                disabled={countdown > 0}
                onClick={() => setStep("credit")}
                style={{ ...styles.btnPrimary, opacity: countdown > 0 ? 0.35 : 1, cursor: countdown > 0 ? "not-allowed" : "pointer" }}
                onMouseEnter={e => { if (countdown === 0) e.currentTarget.style.filter = "brightness(0.88)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
              >
                Continue to Download
              </button>
            </div>
          )}

          {step === "credit" && (
            <div>
              <p style={styles.creditLabel}>
                <strong style={{ color: "#eaeaf0" }}>Please credit SafeMusicLibrary</strong> when using this track in your videos. Copy the text below into your video description:
              </p>
              <div style={styles.creditBox}>
                <button onClick={handleCopy} style={{ ...styles.copyBtn, borderColor: copied ? accent : "#1e1e2a", color: copied ? accent : "#7a7a8e" }}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
                <code style={styles.creditCode}>{creditText}</code>
              </div>

              {track.youtube_url && (
                <a href={track.youtube_url} target="_blank" rel="noopener noreferrer" style={styles.youtubeLink}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,68,68,0.16)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,68,68,0.08)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><polygon points="9.545 15.568 15.818 12 9.545 8.432" fill="#0a0a0f"/></svg>
                  Watch on YouTube
                </a>
              )}

              <div style={styles.divider} />

              <button onClick={handleDownload} style={styles.btnPrimary}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.88)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download MP3
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SKELETON ROW — shown while tracks are loading
// ═══════════════════════════════════════════════
function SkeletonRow({ delay = 0, isMobile = false }) {
  const s = (w, h, extra = {}) => ({
    width: w, height: h, borderRadius: 4,
    background: "#16161f",
    animation: `shimmer 1.6s ease-in-out ${delay}s infinite`,
    ...extra,
  });
  const rowStyle = isMobile
    ? { ...styles.trackRow, gridTemplateColumns: "40px 1fr 80px", cursor: "default", pointerEvents: "none" }
    : { ...styles.trackRow, cursor: "default", pointerEvents: "none" };
  return (
    <div style={rowStyle}>
      <div style={s(36, 36, { borderRadius: "50%" })} />
      <div>
        <div style={s(130, 13, { marginBottom: 7 })} />
        <div style={s(55, 11)} />
      </div>
      {!isMobile && <div style={s(72, 22, { borderRadius: 100 })} />}
      {!isMobile && <div style={s(48, 13)} />}
      {!isMobile && <div style={s(34, 13)} />}
      <div style={s(58, 28, { borderRadius: 100, marginLeft: "auto" })} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
export default function SafeMusicLibrary() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeMood, setActiveMood] = useState("All");
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [downloadTrack, setDownloadTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [subscribers, setSubscribers] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [adBlocked, setAdBlocked] = useState(false);
  const [adBlockDismissed, setAdBlockDismissed] = useState(false);

  const accentTheme = currentTrack ? (MOOD_ACCENT[currentTrack.mood] || DEFAULT_ACCENT) : DEFAULT_ACCENT;
  const accent = accentTheme.color;

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  const filteredTracksRef = useRef([]);
  const currentTrackRef = useRef(null);
  const playTrackRef = useRef(null);
  const volumeTrackRef = useRef(null);

  // Try to load from Supabase on mount
  useEffect(() => {
    (async () => {
      const data = await supabaseFetch("tracks", "select=*&order=created_at.desc");
      if (data && data.length > 0) {
        setTracks(data);
        const param = new URLSearchParams(window.location.search).get("track");
        if (param) {
          const match = data.find(t =>
            t.filename.replace(/\.mp3$/i, "").replace(/\s+/g, "-").toLowerCase() === param.toLowerCase()
          );
          if (match) setTimeout(() => {
            const audio = audioRef.current;
            if (audio) audio.src = `${R2_PUBLIC_URL}/${match.filename}`;
            setCurrentTrack(match);
            setProgress(0);
            setDuration(match.duration);
          }, 0);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
    // Script probe: fires onerror only when actually blocked, not due to content-type
    const script = document.createElement("script");
    script.onerror = () => setAdBlocked(true);
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3266340486490318&t=" + Date.now();
    document.head.appendChild(script);
    // CSS bait fallback for cosmetic-filter blockers
    const bait = document.createElement("div");
    bait.className = "adsbox pub_300x250";
    bait.style.cssText = "width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(bait);
    setTimeout(() => {
      if (bait.offsetHeight === 0 || getComputedStyle(bait).display === "none") setAdBlocked(true);
      document.body.removeChild(bait);
    }, 200);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // Fetch YouTube subscriber count (stale-while-revalidate)
  useEffect(() => {
    if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_HANDLE || isMobile) return;
    const CACHE_KEY = "sml_yt_subscribers";
    const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

    // Show cached value immediately if available
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached?.count != null) setSubscribers(cached.count);
      // Skip fetch if cache is still fresh
      if (cached?.ts && Date.now() - cached.ts < CACHE_TTL) return;
    } catch {}

    // Fetch fresh value in background
    (async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${YOUTUBE_CHANNEL_HANDLE}&key=${YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        const count = data?.items?.[0]?.statistics?.subscriberCount;
        if (count != null) {
          const n = parseInt(count, 10);
          setSubscribers(n);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ count: n, ts: Date.now() }));
        }
      } catch {}
    })();
  }, []);

  // Setup audio element + real event listeners
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.volume = volume;
    }
    const audio = audioRef.current;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => {
      const ft = filteredTracksRef.current;
      const ct = currentTrackRef.current;
      if (ct && ft.length > 1) {
        const idx = ft.findIndex(t => t.id === ct.id);
        playTrackRef.current(ft[(idx + 1) % ft.length]);
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, []);

  const initAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
  }, []);

  const playTrack = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio) return;

    initAudioContext();

    if (currentTrack?.id === track.id) {
      if (isPlaying) { audio.pause(); setIsPlaying(false); }
      else { audio.play().catch(() => {}); setIsPlaying(true); }
      return;
    }

    audio.src = `${R2_PUBLIC_URL}/${track.filename}`;
    audio.play().catch(() => {});
    setCurrentTrack(track);
    setIsPlaying(true);
    setProgress(0);
    setDuration(track.duration);
  }, [currentTrack, isPlaying, initAudioContext]);

  const handleSeek = useCallback((e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setProgress(newTime);
  }, [duration]);

  const handleVolumeMouseDown = useCallback((e) => {
    e.preventDefault();
    const applyVolume = (clientX) => {
      const rect = volumeTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setVolume(ratio);
      if (audioRef.current) audioRef.current.volume = ratio;
      if (ratio > 0) setIsMuted(false);
    };
    applyVolume(e.clientX);
    const onMouseMove = (e) => applyVolume(e.clientX);
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  }, [isMuted]);

  const playNext = useCallback(() => {
    const ft = filteredTracksRef.current;
    const ct = currentTrackRef.current;
    if (!ft.length) return;
    const idx = ct ? ft.findIndex(t => t.id === ct.id) : -1;
    playTrackRef.current(ft[(idx + 1) % ft.length]);
  }, []);

  const playPrev = useCallback(() => {
    const ft = filteredTracksRef.current;
    const ct = currentTrackRef.current;
    if (!ft.length) return;
    const idx = ct ? ft.findIndex(t => t.id === ct.id) : 0;
    playTrackRef.current(ft[(idx - 1 + ft.length) % ft.length]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const audio = audioRef.current;
      switch (e.key) {
        case " ":
        case "F6":
          e.preventDefault();
          if (currentTrackRef.current) playTrackRef.current(currentTrackRef.current);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (audio?.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (audio) audio.currentTime = Math.max(audio.currentTime - 5, 0);
          break;
        case "F5":
          e.preventDefault();
          playPrev();
          break;
        case "F7":
          e.preventDefault();
          playNext();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playNext, playPrev]);

  const filteredTracks = tracks.filter(t => {
    const matchesMood = activeMood === "All" || t.mood === activeMood;
    const q = search.toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.mood.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
    return matchesMood && matchesSearch;
  });

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const totalDownloads = tracks.reduce((sum, t) => sum + (t.download_count || 0), 0);

  // Keep refs in sync so stale-closure callbacks always see current values
  filteredTracksRef.current = filteredTracks;
  currentTrackRef.current = currentTrack;
  playTrackRef.current = playTrack;

  return (
    <div style={{ ...styles.root, "--accent": accent, "--accent-subtle": accentTheme.subtle }}>
      {/* ── NAV ── */}
      <nav style={{ ...styles.nav, ...(isMobile ? { padding: "0 16px" } : {}) }}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>
            <img src="/SML-Waveform-logo-thick.png" alt="SML" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span><span style={{ fontWeight: 700 }}>SafeMusic</span><span style={{ fontWeight: 300 }}>Library</span></span>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ ...styles.hero, ...(isMobile ? { padding: "130px 16px 32px" } : {}) }}>
        <div style={styles.heroGlow} />
        <h1 style={{ ...styles.heroTitle, ...(isMobile ? { fontSize: 33, letterSpacing: -0.5 } : {}) }}>
          Free Music for <span style={{ color: "var(--accent)", transition: "color 0.5s" }}>Creators</span>
        </h1>
        <p style={styles.heroSub}>
          High-quality, copyright-free instrumental music ready for your next project.
        </p>
      </div>

      {/* ── SEARCH & FILTERS ── */}
      <div style={{ ...styles.controls, ...(isMobile ? { padding: "0 16px 14px" } : {}) }}>
        <div style={styles.searchBar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4a5e" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search tracks, moods, genres..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          {search && (
            <button onClick={() => setSearch("")} style={styles.clearBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {!isMobile && <div style={styles.filters}>
          {MOODS.map(mood => (
            <button
              key={mood}
              onClick={() => setActiveMood(mood)}
              style={{
                ...styles.filterChip,
                ...(activeMood === mood ? styles.filterChipActive : {}),
              }}
              onMouseEnter={e => {
                if (activeMood === mood) {
                  e.currentTarget.style.filter = "brightness(0.88)";
                } else {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "#3a3a4a";
                  e.currentTarget.style.color = "#eaeaf0";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = "";
                e.currentTarget.style.background = activeMood === mood ? "var(--accent)" : "transparent";
                e.currentTarget.style.borderColor = activeMood === mood ? "var(--accent)" : "#2a2a3a";
                e.currentTarget.style.color = activeMood === mood ? "#0a0a0f" : "#7a7a8e";
              }}
            >
              {mood}
            </button>
          ))}
        </div>}
      </div>

      {/* ── STATS ── */}
      <div style={{ ...styles.stats, ...(isMobile ? { justifyContent: "center", margin: "0 auto 20px", padding: "0 16px" } : {}) }}>
        <div style={{ ...styles.statCard, ...(isMobile ? { flex: 1 } : {}) }}>
          <div style={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <div style={{ ...styles.statNumber, ...(isMobile ? { fontSize: 18 } : {}) }}>{tracks.length}</div>
            <div style={{ ...styles.statLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>FREE TRACKS</div>
          </div>
        </div>
        <div style={{ ...styles.statCard, ...(isMobile ? { flex: 1 } : {}) }}>
          <div style={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div>
            <div style={{ ...styles.statNumber, ...(isMobile ? { fontSize: 18 } : {}) }}>{loading ? "—" : formatCount(totalDownloads)}</div>
            <div style={{ ...styles.statLabel, ...(isMobile ? { fontSize: 10 } : {}) }}>DOWNLOADS</div>
          </div>
        </div>
        {!isMobile && <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><polygon points="9.545 15.568 15.818 12 9.545 8.432" fill="#0a0a0f"/></svg>
          </div>
          <div>
            <div style={styles.statNumber}>{formatCount(subscribers)}</div>
            <div style={styles.statLabel}>SUBSCRIBERS</div>
          </div>
        </div>}
      </div>

      {/* ── TRACK LIST ── */}
      <div style={{ ...styles.trackList, ...(isMobile ? { padding: "0 8px" } : {}) }}>
        {!isMobile && (
          <div style={styles.trackListHeader}>
            <span style={styles.headerLabel} />
            <span style={styles.headerLabel}>Title</span>
            <span style={styles.headerLabel}>Mood</span>
            <span style={styles.headerLabel}>Genre</span>
            <span style={styles.headerLabel}>Duration</span>
            <span style={styles.headerLabel} />
          </div>
        )}

        {loading && (
          [0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => <SkeletonRow key={i} delay={delay} isMobile={isMobile} />)
        )}

        {!loading && filteredTracks.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#4a4a5e" }}>
            No tracks match your search.
          </div>
        )}

        {filteredTracks.map(track => {
          const playing = currentTrack?.id === track.id && isPlaying;
          const mc = MOOD_COLORS[track.mood] || MOOD_COLORS.Dark;
          return (
            <div
              key={track.id}
              style={{ ...styles.trackRow, ...(isMobile ? { gridTemplateColumns: "40px 1fr 80px" } : {}), background: currentTrack?.id === track.id ? "#16161f" : "transparent" }}
              onClick={() => playTrack(track)}
              onMouseEnter={e => { if (currentTrack?.id !== track.id) e.currentTarget.style.background = "#1c1c28"; }}
              onMouseLeave={e => { if (currentTrack?.id !== track.id) e.currentTarget.style.background = "transparent"; }}
            >
              <button style={{ ...styles.playBtn, background: playing || currentTrack?.id === track.id ? "var(--accent)" : "#16161f", color: playing || currentTrack?.id === track.id ? "#0a0a0f" : "#7a7a8e", transition: "background 0.5s" }}>
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
              <div>
                <div style={{ ...styles.trackTitle, color: currentTrack?.id === track.id ? "var(--accent)" : "#eaeaf0", transition: "color 0.5s" }}>{track.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={styles.trackArtist}>{track.artist}</span>
                  {isMobile && (
                    <span style={{ ...styles.moodTag, background: mc.bg, color: mc.text, fontSize: 10, padding: "2px 7px" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: mc.dot }} />
                      {track.mood}
                    </span>
                  )}
                </div>
              </div>
              {!isMobile && (
                <div>
                  <span style={{ ...styles.moodTag, background: mc.bg, color: mc.text }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: mc.dot }} />
                    {track.mood}
                  </span>
                </div>
              )}
              {!isMobile && <div style={{ color: "#7a7a8e", fontSize: 13 }}>{track.genre}</div>}
              {!isMobile && <div style={styles.trackDuration}>{formatTime(track.duration)}</div>}
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={e => { e.stopPropagation(); setDownloadTrack(track); }}
                  style={styles.downloadBtn}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a3a"; e.currentTarget.style.color = "#7a7a8e"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  MP3
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM PLAYER ── */}
      <div style={{ ...styles.player, ...(isMobile ? { display: "flex", flexDirection: "column", padding: 0, gridTemplateColumns: "unset", alignItems: "stretch" } : {}) }}>
        <Visualizer analyser={analyserRef.current} isPlaying={isPlaying} accent={accent} />

        {isMobile ? (
          <>
            {/* Track info row */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 16px", width: "100%", flex: 1, position: "relative", zIndex: 2, boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                <div style={styles.playerThumb}>
                  {isPlaying ? (
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20 }}>
                      {[8,16,12,18,10].map((h,i) => (
                        <div key={i} style={{ width: 3, borderRadius: 2, background: "var(--accent)", animation: `eqBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`, height: h, transition: "background 0.5s" }} />
                      ))}
                    </div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4a5e" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: currentTrack ? "var(--accent)" : "#4a4a5e", transition: "color 0.5s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentTrack ? currentTrack.title : "No track selected"}
                  </div>
                  <div style={{ fontSize: 12, color: "#7a7a8e", marginTop: 2 }}>
                    {currentTrack ? currentTrack.artist : "—"}
                  </div>
                </div>
              </div>
              <button onClick={() => currentTrack && playTrack(currentTrack)} style={{ ...styles.playMainBtn, flexShrink: 0 }}>
                {isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
            </div>
            {/* Progress bar with timers */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 10px", position: "relative", zIndex: 2, width: "100%", boxSizing: "border-box" }}>
              <span style={styles.timeLabel}>{formatTime(progress)}</span>
              <div style={{ ...styles.progressTrack, flex: 1, cursor: "pointer" }} onClick={handleSeek}>
                <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
              </div>
              <span style={styles.timeLabel}>{formatTime(duration)}</span>
            </div>
          </>
        ) : (
          <>
        <div style={styles.playerTrackInfo}>
          <div style={styles.playerThumb}>
            {isPlaying ? (
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20 }}>
                {[8,16,12,18,10].map((h,i) => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2, background: "var(--accent)",
                    animation: `eqBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                    height: h, transition: "background 0.5s",
                  }} />
                ))}
              </div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4a5e" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: currentTrack ? "var(--accent)" : "#4a4a5e", transition: "color 0.5s" }}>
              {currentTrack ? currentTrack.title : "No track selected"}
            </div>
            <div style={{ fontSize: 12, color: "#7a7a8e", marginTop: 2 }}>
              {currentTrack ? currentTrack.artist : "—"}
            </div>
          </div>
        </div>

        <div style={styles.playerCenter}>
          <div style={styles.playerControls}>
            <button onClick={playPrev} style={styles.controlBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
            </button>
            <button
              onClick={() => currentTrack && playTrack(currentTrack)}
              style={styles.playMainBtn}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <button onClick={playNext} style={styles.controlBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            </button>
          </div>
          <div style={styles.progressBar}>
            <span style={styles.timeLabel}>{formatTime(progress)}</span>
            <div style={{ ...styles.progressTrack, cursor: "pointer" }} onClick={handleSeek}>
              <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
            </div>
            <span style={styles.timeLabel}>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={styles.playerRight}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleMute} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a4a5e", display: "flex", padding: 0, alignItems: "center" }}>
              {isMuted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : volume < 0.5 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
              )}
            </button>
            <div ref={volumeTrackRef} style={{ ...styles.volumeTrack, cursor: "pointer" }} onMouseDown={handleVolumeMouseDown}>
              <div style={{ ...styles.volumeFill, width: `${isMuted ? 0 : volume * 100}%` }} />
            </div>
          </div>
          {currentTrack && (
            <button
              onClick={() => setDownloadTrack(currentTrack)}
              style={styles.playerDownloadBtn}
              onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = "#0a0a0f"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--accent)"; }}
            >
              Download
            </button>
          )}
        </div>
          </>
        )}
      </div>

      {/* ── ADBLOCK POPUP ── */}
      {adBlocked && !adBlockDismissed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,10,0.85)", backdropFilter: "blur(12px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#12121a", border: "1px solid #2a2a3a", borderRadius: 16, width: 440, maxWidth: "90vw", padding: "32px 32px 28px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1a1a26", border: "1px solid #2a2a3a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, color: "#eaeaf0", marginBottom: 12 }}>Ad blocker detected</div>
            <div style={{ fontSize: 14, color: "#7a7a8e", lineHeight: 1.7, marginBottom: 28 }}>
              SafeMusicLibrary is completely free — ads are the only way we keep it that way.<br /><br />
              Please whitelist <strong style={{ color: "#eaeaf0" }}>safemusiclibrary.com</strong> in your ad blocker to support the site. It only takes a second!
            </div>
            <button
              onClick={() => setAdBlockDismissed(true)}
              style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", background: accent, color: "#0a0a0f", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              I've disabled my ad blocker
            </button>
            <button
              onClick={() => setAdBlockDismissed(true)}
              style={{ marginTop: 12, background: "none", border: "none", color: "#4a4a5e", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}

      {/* ── DOWNLOAD MODAL ── */}
      {downloadTrack && (
        <DownloadModal track={downloadTrack} onClose={() => setDownloadTrack(null)} adBlocked={adBlocked} />
      )}

      {/* ── EQ BAR ANIMATION ── */}
      <style>{`
        @keyframes eqBar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        @keyframes shimmer {
          0%, 100% { background-color: #16161f; }
          50% { background-color: #1e1e2a; }
        }
        input::placeholder { color: #7a7a8e; opacity: 1; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const styles = {
  root: { background: "#0a0a0f", color: "#eaeaf0", fontFamily: "'Outfit', sans-serif", minHeight: "100vh", paddingBottom: 110 },

  // Nav
  nav: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid #1e1e2a" },
  logo: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 20, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 10 },
  logoMark: { width: 40, height: 40, background: "transparent", border: "1.5px solid var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: 3, boxSizing: "border-box", transition: "border-color 0.5s", overflow: "hidden" },
  navLinks: { display: "flex", gap: 32, alignItems: "center" },
  navLink: { color: "#7a7a8e", textDecoration: "none", fontSize: 14, fontWeight: 500 },

  // Hero
  hero: { padding: "140px 40px 60px", textAlign: "center", position: "relative", overflow: "hidden" },
  heroGlow: { position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: "radial-gradient(circle, var(--accent-subtle) 0%, transparent 60%)", pointerEvents: "none", transition: "background 0.5s" },
  heroTitle: { fontSize: 52, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16, position: "relative" },
  heroSub: { color: "#7a7a8e", fontSize: 17, maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.6, position: "relative" },

  // Controls
  controls: { maxWidth: 1100, margin: "0 auto", padding: "0 40px 32px" },
  searchBar: { display: "flex", alignItems: "center", gap: 12, background: "#12121a", border: "1px solid #1e1e2a", borderRadius: 12, padding: "14px 20px", marginBottom: 20 },
  searchInput: { flex: 1, background: "none", border: "none", outline: "none", color: "#eaeaf0", fontFamily: "'Outfit', sans-serif", fontSize: 15 },
  clearBtn: { background: "none", border: "none", color: "#4a4a5e", cursor: "pointer", display: "flex", padding: 4 },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterChip: { padding: "8px 18px", borderRadius: 100, border: "1px solid #2a2a3a", background: "transparent", color: "#7a7a8e", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", outline: "none" },
  filterChipActive: { background: "var(--accent)", border: "1px solid var(--accent)", color: "#0a0a0f", fontWeight: 600, transition: "background 0.5s, border 0.5s" },

  // Stats
  stats: { maxWidth: 1100, margin: "0 auto 32px", padding: "0 40px", display: "flex", gap: 24 },
  statCard: { padding: "20px 24px", background: "#16161f", border: "1px solid #1e1e2a", borderRadius: 12, flex: 1, display: "flex", alignItems: "center", gap: 16 },
  statIcon: { width: 44, height: 44, borderRadius: 10, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", transition: "background 0.5s, color 0.5s" },
  statNumber: { fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace" },
  statLabel: { fontSize: 12, color: "#4a4a5e", letterSpacing: 0.8, marginTop: 2 },

  // Track list
  trackList: { maxWidth: 1100, margin: "0 auto", padding: "0 40px" },
  trackListHeader: { display: "grid", gridTemplateColumns: "48px 1.5fr 1fr 0.7fr 80px 100px", alignItems: "center", padding: "0 20px 12px", borderBottom: "1px solid #1e1e2a", marginBottom: 8 },
  headerLabel: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: "#4a4a5e" },
  trackRow: { display: "grid", gridTemplateColumns: "48px 1.5fr 1fr 0.7fr 80px 100px", alignItems: "center", padding: "14px 20px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s" },
  playBtn: { width: 36, height: 36, borderRadius: "50%", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" },
  trackTitle: { fontWeight: 600, fontSize: 15, transition: "color 0.2s" },
  trackArtist: { color: "#7a7a8e", fontSize: 13, marginTop: 2 },
  moodTag: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500 },
  trackDuration: { color: "#7a7a8e", fontFamily: "'Space Mono', monospace", fontSize: 13 },
  downloadBtn: { padding: "7px 16px", borderRadius: 100, border: "1px solid #1e1e2a", background: "transparent", color: "#7a7a8e", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 },

  // Player
  player: { position: "fixed", bottom: 0, left: 0, right: 0, height: 96, background: "#0d0d14", borderTop: "1px solid #1e1e2a", zIndex: 200, display: "grid", gridTemplateColumns: "300px 1fr 300px", alignItems: "center", padding: "0 28px", overflow: "hidden" },
  playerTrackInfo: { display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 2 },
  playerThumb: { width: 52, height: 52, borderRadius: 8, background: "linear-gradient(135deg, #1a1a2e, #0d0d14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  playerCenter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 2 },
  playerControls: { display: "flex", alignItems: "center", gap: 20 },
  controlBtn: { background: "none", border: "none", color: "#7a7a8e", cursor: "pointer", display: "flex", alignItems: "center" },
  playMainBtn: { width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "#0a0a0f", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.5s" },
  progressBar: { width: "100%", maxWidth: 500, display: "flex", alignItems: "center", gap: 10 },
  timeLabel: { fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#4a4a5e", minWidth: 36 },
  progressTrack: { flex: 1, height: 4, background: "#1e1e2a", borderRadius: 2, position: "relative", overflow: "hidden" },
  progressFill: { position: "absolute", left: 0, top: 0, height: "100%", background: "var(--accent)", borderRadius: 2, transition: "width 0.2s, background 0.5s" },
  playerRight: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, position: "relative", zIndex: 2 },
  volumeTrack: { width: 80, height: 4, background: "#1e1e2a", borderRadius: 2, position: "relative", overflow: "hidden" },
  volumeFill: { position: "absolute", left: 0, top: 0, height: "100%", background: "var(--accent)", borderRadius: 2, transition: "background 0.5s" },
  playerDownloadBtn: { padding: "6px 14px", borderRadius: 100, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },

  // Modal
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(5,5,10,0.85)", backdropFilter: "blur(12px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#12121a", border: "1px solid #1e1e2a", borderRadius: 16, width: 480, maxWidth: "90vw", overflow: "hidden" },
  modalHeader: { padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  modalIcon: { width: 32, height: 32, borderRadius: 8, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" },
  closeBtn: { background: "none", border: "none", color: "#4a4a5e", cursor: "pointer", padding: 4, display: "flex" },
  modalBody: { padding: "20px 28px 28px" },
  modalTrackName: { fontFamily: "'Space Mono', monospace", fontSize: 14, color: "var(--accent)", marginBottom: 20, padding: "10px 14px", background: "var(--accent-subtle)", borderRadius: 8, border: "1px solid var(--accent-subtle)" },
  adSupportMsg: { fontSize: 13, color: "#7a7a8e", lineHeight: 1.6, marginBottom: 20, padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "3px solid var(--accent)" },
  adPlaceholder: { width: "100%", height: 180, background: "#16161f", border: "1px dashed #1e1e2a", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#4a4a5e", fontSize: 13, marginBottom: 16 },
  timerCircle: { width: 48, height: 48, borderRadius: "50%", border: "3px solid #1e1e2a", borderTopColor: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "var(--accent)" },
  btnPrimary: { width: "100%", padding: 14, borderRadius: 8, border: "none", background: "var(--accent)", color: "#0a0a0f", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "filter 0.15s" },
  creditLabel: { fontSize: 13, color: "#7a7a8e", marginBottom: 10, lineHeight: 1.5 },
  creditBox: { background: "#16161f", border: "1px solid #1e1e2a", borderRadius: 8, padding: "14px 16px", marginBottom: 16, position: "relative" },
  copyBtn: { position: "absolute", top: 10, right: 10, padding: "6px 12px", borderRadius: 6, border: "1px solid #1e1e2a", background: "#12121a", color: "#7a7a8e", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  creditCode: { fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#7a7a8e", lineHeight: 1.7, display: "block", whiteSpace: "pre-wrap" },
  youtubeLink: { display: "flex", alignItems: "center", gap: 8, color: "#ff4444", textDecoration: "none", fontSize: 13, fontWeight: 600, padding: "10px 14px", background: "rgba(255,68,68,0.08)", borderRadius: 8, marginBottom: 0, transition: "background 0.2s" },
  divider: { height: 1, background: "#1e1e2a", margin: "20px 0" },
};