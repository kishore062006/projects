import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, Upload, AlertTriangle, Cpu, X } from 'lucide-react';
import { motion } from 'framer-motion';

export function ReportIssue() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState("Water Leakage (SDG 6)");
  const [location, setLocation] = useState("40.7128° N, 74.0060° W");
  const [description, setDescription] = useState("");
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [isAITagging, setIsAITagging] = useState(false);

  // WebRTC Camera State & Refs for Laptop Webcam support
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera if component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // START CAMERA - FIXED FOR LAPTOPS!
  const startCamera = async () => {
    try {
      // Changed to `{ video: true }` so it defaults to your laptop's built-in webcam
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      
      // Need a slight delay to ensure video element is rendered before attaching stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access your laptop camera. Please make sure you clicked 'Allow' when the browser asked for permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the image horizontally if it's a front-facing laptop camera so it feels natural
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImagePreview(dataUrl);
        stopCamera();
        triggerAITagging(); 
      }
    }
  };

  const triggerAITagging = () => {
    setIsAITagging(true);
    setTimeout(() => {
      const aiCategories = ["Water Leakage (SDG 6)", "Illegal Dumping (SDG 11)", "Damaged Green Infrastructure (SDG 13)"];
      const detectedCategory = aiCategories[Math.floor(Math.random() * aiCategories.length)];
      setCategory(detectedCategory);
      setDescription(`AI Auto-detected: Potential ${detectedCategory.split('(')[0].trim()} spotted in the image. Requires immediate attention.`);
      setIsAITagging(false);
    }, 2500);
  };

  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      setIsFetchingGPS(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          const formattedLat = `${Math.abs(Number(lat))}° ${Number(lat) >= 0 ? 'N' : 'S'}`;
          const formattedLng = `${Math.abs(Number(lng))}° ${Number(lng) >= 0 ? 'E' : 'W'}`;
          setLocation(`${formattedLat}, ${formattedLng}`);
          setIsFetchingGPS(false);
        },
        (error) => {
          console.error("Error fetching GPS:", error);
          alert("Could not fetch location. Please check your browser permissions.");
          setIsFetchingGPS(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        triggerAITagging(); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const reportData = {
      type: category.split(' (')[0],
      priority: category.includes('SDG 6') ? 'Critical' : 'High',
      reporter: 'Jane D.',
      location,
      description,
      image: imagePreview,
    };

    try {
      const reportToStore = {
        id: `TKT-${Math.floor(Math.random() * 10000)}`,
        ...reportData,
        status: 'Open',
        time: 'Just now',
        timestamp: new Date().toISOString(),
        category,
      };

      const existingReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]');
      localStorage.setItem('ecoSyncReports', JSON.stringify([reportToStore, ...existingReports]));

      const newAction = {
        id: Date.now(),
        title: `Reported ${reportToStore.type}`,
        time: 'Just now',
        points: '+50',
        type: 'report'
      };
      const existingActions = JSON.parse(localStorage.getItem('ecoActions') || '[]');
      localStorage.setItem('ecoActions', JSON.stringify([newAction, ...existingActions]));

      const currentPoints = parseInt(localStorage.getItem('ecoPoints') || '0');
      localStorage.setItem('ecoPoints', (currentPoints + 50).toString());

    } catch (error) {
      console.error("Failed to save report", error);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="relative flex-1 h-screen flex items-center justify-center bg-[#050505] text-white p-8 pl-[300px] md:pl-[320px] overflow-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/10 blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="relative z-10 max-w-md w-full bg-white/[0.02] backdrop-blur-[50px] saturate-[1.5] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_32px_rgba(0,0,0,0.4)] rounded-[32px] p-8 text-center overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
            >
              <AlertTriangle size={40} />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2 tracking-tight">Issue Reported!</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">Thank you for being an Eco Warden. The municipal authority has been notified. You earned 50 Leaves!</p>
            <button 
              onClick={() => {
                setSubmitted(false);
                setImagePreview(null);
                setDescription(""); 
              }}
              className="w-full py-4 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white rounded-2xl font-medium transition-colors shadow-inner"
            >
              Report Another Issue
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-white p-8 md:p-12 pl-[300px] md:pl-[320px]">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <h2 className="text-4xl font-bold mb-3 tracking-tight">Report Civic Issue</h2>
          <p className="text-zinc-400 text-lg">Help authorities identify and resolve environmental hazards in your community.</p>
        </motion.header>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onSubmit={handleSubmit} 
          className="space-y-6"
        >
          <div className="relative bg-white/[0.02] backdrop-blur-[50px] saturate-[1.5] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_32px_rgba(0,0,0,0.4)] rounded-[32px] p-8 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>
            
            <div className="relative z-10 space-y-8">
              
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1 flex justify-between">
                  <span>Evidence (Photo/Video)</span>
                  {isAITagging && <span className="text-emerald-400 flex items-center gap-1 text-xs"><Cpu size={14} className="animate-pulse"/> AI Analyzing Image...</span>}
                </label>
                
                {isCameraOpen ? (
                  <div className="border-2 border-solid border-emerald-500/50 rounded-[28px] p-2 text-center bg-black/40 shadow-inner relative overflow-hidden h-[300px] flex flex-col items-center justify-center">
                    {/* ADDED: transform scale-x-[-1] to mirror the laptop webcam so it doesn't feel backwards */}
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline
                      muted 
                      className="w-full h-full object-cover rounded-[20px] transform scale-x-[-1]" 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-20">
                      <button 
                        type="button" 
                        onClick={stopCamera} 
                        className="w-12 h-12 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                      >
                        <X size={20} />
                      </button>
                      <button 
                        type="button" 
                        onClick={capturePhoto} 
                        className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all flex items-center gap-2"
                      >
                        <Camera size={18} /> Capture
                      </button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <label className="block cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageChange} 
                    />
                    <div className="border-2 border-solid border-emerald-500/30 rounded-[28px] p-2 text-center bg-black/20 shadow-inner relative overflow-hidden h-[220px] group transition-all">
                      <img src={imagePreview} alt="Evidence preview" className={`w-full h-full object-cover rounded-[20px] ${isAITagging ? 'opacity-50 grayscale blur-sm' : ''} transition-all duration-500`} />
                      {isAITagging && (
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                         </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[20px] m-2">
                        <Camera size={32} className="text-white mb-2" />
                        <p className="text-white font-medium">Tap to change photo</p>
                      </div>
                    </div>
                  </label>
                ) : (
                  <div className="flex gap-4">
                    <div 
                      onClick={startCamera}
                      className="flex-1 cursor-pointer h-full border-2 border-dashed border-white/10 rounded-[28px] p-6 text-center hover:bg-white/[0.02] hover:border-emerald-500/50 transition-all group bg-black/10 shadow-inner flex flex-col items-center justify-center"
                    >
                      <div className="w-14 h-14 bg-white/[0.05] border border-white/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all shadow-sm">
                        <Camera size={24} className="text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <p className="text-zinc-200 font-medium mb-1">Open Camera</p>
                      <p className="text-[11px] text-zinc-500 leading-tight">Take a live photo</p>
                    </div>

                    <label className="flex-1 cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageChange} 
                      />
                      <div className="h-full border-2 border-dashed border-white/10 rounded-[28px] p-6 text-center hover:bg-white/[0.02] hover:border-emerald-500/50 transition-all group bg-black/10 shadow-inner flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-white/[0.05] border border-white/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all shadow-sm">
                          <Upload size={24} className="text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <p className="text-zinc-200 font-medium mb-1">Upload File</p>
                        <p className="text-[11px] text-zinc-500 leading-tight">Choose from gallery</p>
                      </div>
                    </label>
                  </div>
                )}
              </motion.div>

              {/* Category */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Issue Category {isAITagging ? '(Auto-Detecting...)' : ''}</label>
                <div className="relative">
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full bg-black/20 border ${isAITagging ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/10'} rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all appearance-none shadow-inner cursor-pointer`}
                  >
                    <option className="bg-zinc-900">Water Leakage (SDG 6)</option>
                    <option className="bg-zinc-900">Illegal Dumping (SDG 11)</option>
                    <option className="bg-zinc-900">Polluted Water Body (SDG 6)</option>
                    <option className="bg-zinc-900">Damaged Green Infrastructure (SDG 13)</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    ▼
                  </div>
                </div>
              </motion.div>

              {/* Location */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Location</label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <MapPin size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input 
                      type="text" 
                      placeholder="Fetching GPS coordinates..." 
                      className="w-full bg-black/20 border border-white/10 rounded-2xl pl-14 pr-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all shadow-inner"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleGetLocation}
                    disabled={isFetchingGPS}
                    className="px-6 py-4 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-2xl text-sm font-medium transition-colors shadow-inner flex items-center justify-center min-w-[100px]"
                  >
                    {isFetchingGPS ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update'}
                  </button>
                </div>
              </motion.div>

              {/* Description */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Additional Details</label>
                <textarea 
                  rows={4}
                  placeholder="Describe the severity of the issue..."
                  className={`w-full bg-black/20 border ${isAITagging ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/10'} rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all resize-none shadow-inner`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </motion.div>
            </div>
          </div>

          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            type="submit" 
            disabled={isSubmitting || isAITagging || isCameraOpen}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[24px] font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting to Authorities...
              </>
            ) : (
              <>
                <Upload size={22} />
                Submit Report
              </>
            )}
          </motion.button>
        </motion.form>
      </div>
    </div>
  );
}