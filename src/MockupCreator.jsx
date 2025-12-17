import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  Download, 
  Sparkles, 
  Undo, 
  Maximize, 
  Type, 
  Palette,
  Share2,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';

const MockupCreator = () => {
  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // pencil, eraser
  const [brushSize, setBrushSize] = useState(3);
  const [color, setColor] = useState('#000000');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 400 });

  // Refs
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Constants
  const CANVAS_BG = '#ffffff';
  const MAX_HISTORY_SIZE = 50;

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    const setupCanvas = () => {
      // Set resolution for high DPI displays
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = 400 * dpr;
      
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = '400px';

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      
      // Fill white background initially
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, rect.width, 400);

      contextRef.current = ctx;
      setCanvasSize({ width: rect.width, height: 400 });
      
      // Save initial blank state
      saveHistory();
    };

    setupCanvas();

    // Handle window resize
    const handleResize = () => {
      const imageData = contextRef.current?.getImageData(0, 0, canvas.width, canvas.height);
      setupCanvas();
      if (imageData && contextRef.current) {
        contextRef.current.putImageData(imageData, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (contextRef.current) {
        contextRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Update context when tools change
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
      contextRef.current.strokeStyle = tool === 'eraser' ? CANVAS_BG : color;
    }
  }, [brushSize, color, tool]);

  // Canvas History Helper with bounds checking
  const saveHistory = useCallback(() => {
    if (!canvasRef.current) return;
    
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(canvasRef.current.toDataURL());
    
    // Limit history size to prevent memory issues
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

  const undo = useCallback(() => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      const img = new Image();
      img.src = history[newStep];
      img.onload = () => {
        const ctx = contextRef.current;
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        if (ctx && canvas) {
          // Clear and redraw
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
          ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        }
      };
    }
  }, [history, historyStep]);

  // Drawing Handlers with improved touch support
  const getCoordinates = useCallback((event) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getCoordinates(e);
    
    if (contextRef.current) {
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
      setIsDrawing(true);
      isDrawingRef.current = true;
    }
  }, [getCoordinates]);

  const draw = useCallback((e) => {
    if (!isDrawingRef.current || !contextRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getCoordinates(e);
    
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  }, [getCoordinates]);

  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current && contextRef.current) {
      contextRef.current.closePath();
      setIsDrawing(false);
      isDrawingRef.current = false;
      saveHistory();
    }
  }, [saveHistory]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      saveHistory();
    }
  }, [saveHistory]);

  // AI Generation Logic with improved error handling
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please describe your product idea in the text box.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Get API key from environment variables
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("API key not configured. Please set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY environment variable.");
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not available");
      }

      const base64Image = canvas.toDataURL('image/png').split(',')[1];

      // Construct a robust system prompt
      const enhancedPrompt = `
        Act as a professional industrial designer and visualization expert.
        Take the provided rough sketch and the user's description: "${prompt}".
        
        Task: Create a high-fidelity, photorealistic product mockup.
        - Maintain the composition and perspective of the sketch.
        - Apply the materials, colors, and lighting implied by the description.
        - Fix perspective errors and clean up lines to look like a manufactured object.
        - Render it on a clean, professional studio background.
      `;

      // Helper for exponential backoff
      const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            if (response.status === 429 && retries > 0) {
              await new Promise(r => setTimeout(r, delay));
              return fetchWithRetry(url, options, retries - 1, delay * 2);
            }
            throw new Error(`API Error: ${response.statusText} (${response.status})`);
          }
          return response;
        } catch (err) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return fetchWithRetry(url, options, retries - 1, delay * 2);
          }
          throw err;
        }
      };

      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: enhancedPrompt },
                { 
                  inlineData: {
                    mimeType: "image/png",
                    data: base64Image
                  }
                }
              ]
            }],
            generationConfig: {
              responseModalities: ["IMAGE"]
            }
          })
        }
      );

      const data = await response.json();
      
      // Extract image with better error handling
      const generatedBase64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
      if (generatedBase64) {
        setGeneratedImage(`data:image/png;base64,${generatedBase64}`);
      } else {
        const errorMessage = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || 
                           "No image generated. Try adjusting your description.";
        throw new Error(errorMessage);
      }

    } catch (err) {
      console.error('Generation error:', err);
      const errorMessage = err.message.includes("API key") 
        ? err.message 
        : "Failed to generate mockup. Please try again or simplify your request.";
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt]);

  const downloadImage = useCallback((dataUrl, name) => {
    const link = document.createElement('a');
    link.download = name;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100">
      
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">IdeaForge</h1>
          </div>
          <div className="text-sm text-neutral-500 hidden sm:block">
            Draw your idea + Describe it = Reality
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input (Canvas + Text) */}
          <div className="space-y-6">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setTool('pencil')}
                  className={`p-2 rounded-lg transition-colors ${tool === 'pencil' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-neutral-100 text-neutral-600'}`}
                  title="Pencil"
                  aria-label="Select pencil tool"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-neutral-100 text-neutral-600'}`}
                  title="Eraser"
                  aria-label="Select eraser tool"
                >
                  <Eraser className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-neutral-200 mx-2" />
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                  title="Color Picker"
                  aria-label="Select brush color"
                />
                <div className="flex items-center px-2">
                  <span className="text-xs text-neutral-500 mr-2">Size</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-20 accent-indigo-600 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                    aria-label="Brush size"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={undo}
                  disabled={historyStep <= 0}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Undo"
                  aria-label="Undo last action"
                >
                  <Undo className="w-5 h-5" />
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                  title="Clear All"
                  aria-label="Clear canvas"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div 
              ref={containerRef}
              className="relative bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden cursor-crosshair touch-none"
              style={{ minHeight: '400px' }}
              role="application"
              aria-label="Drawing canvas"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                className="block w-full h-full"
              />
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium text-neutral-500 pointer-events-none select-none border border-neutral-100">
                Canvas
              </div>
            </div>

            {/* Prompt Area */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-4 h-4 text-indigo-600" />
                <label htmlFor="prompt-input" className="text-sm font-semibold text-neutral-900">Description</label>
              </div>
              <textarea
                id="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your product... e.g., 'A futuristic coffee maker, matte black finish with chrome accents, glowing blue LED indicator, sleek minimalist design'"
                className="w-full h-24 p-3 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm transition-all bg-neutral-50 focus:bg-white"
                aria-label="Product description"
              />
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center space-x-2 text-white font-medium transition-all transform active:scale-[0.98]
                  ${isGenerating || !prompt.trim()
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  }`}
                aria-label="Generate mockup"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Forging Prototype...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Mockup</span>
                  </>
                )}
              </button>
              
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-2" role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Result */}
          <div className="space-y-6">
            <div className="h-full flex flex-col">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                   <ImageIcon className="w-5 h-5 text-indigo-600" />
                   Result
                 </h2>
                 {generatedImage && (
                   <button
                     onClick={() => downloadImage(generatedImage, 'mockup.png')}
                     className="text-sm flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                     aria-label="Download generated mockup"
                   >
                     <Download className="w-4 h-4" />
                     Download
                   </button>
                 )}
               </div>

               <div className="flex-grow bg-white rounded-xl border border-neutral-200 shadow-sm p-4 flex items-center justify-center min-h-[400px] lg:min-h-[600px] relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" role="region" aria-label="Generated result">
                  
                  {!generatedImage && !isGenerating && (
                    <div className="text-center space-y-3 max-w-sm px-4">
                      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Palette className="w-8 h-8 text-neutral-400" />
                      </div>
                      <h3 className="text-neutral-900 font-medium">Ready to Create</h3>
                      <p className="text-neutral-500 text-sm">
                        Sketch your idea on the left, describe the materials, and hit Generate to see the magic.
                      </p>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" role="status" aria-label="Loading"></div>
                      <p className="text-indigo-900 font-medium animate-pulse">Designing your product...</p>
                    </div>
                  )}

                  {generatedImage && (
                    <img 
                      src={generatedImage} 
                      alt="Generated Mockup" 
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg animate-in fade-in zoom-in duration-500"
                    />
                  )}
               </div>

               {/* Tips Section */}
               <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                   <h4 className="font-semibold text-indigo-900 text-sm mb-2">Pro Tip: Sketching</h4>
                   <p className="text-indigo-700 text-xs leading-relaxed">
                     You don't need to be an artist. Simple shapes and outlines work best. The AI uses your lines as a structure guide.
                   </p>
                 </div>
                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                   <h4 className="font-semibold text-emerald-900 text-sm mb-2">Pro Tip: Describing</h4>
                   <p className="text-emerald-700 text-xs leading-relaxed">
                     Be specific about materials (e.g., "brushed aluminum", "oak wood") and lighting (e.g., "soft studio lighting").
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MockupCreator;
