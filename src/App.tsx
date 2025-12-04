import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Search, 
  Play, 
  Upload, 
  User, 
  LogOut, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Lock,
  Database,
  HardDrive,
  Cloud,
  Settings,
  Copy,
  Sparkles,
  Bot,
  AlertCircle,
  Download,
  Files,
  Trash2,
  Globe,
  Flag,
  BookOpen
} from 'lucide-react';

// --- Types ---

type UserRole = 'admin' | 'user';
type UserStatus = 'pending' | 'active' | 'rejected';

interface UserAccount {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed!
  role: UserRole;
  status: UserStatus;
}

interface TranscriptSegment {
  startTime: string; // Format "MM:SS"
  endTime: string;
  text: string;
  seconds: number; // Pre-calculated start seconds for seeking
}

interface VideoData {
  id: string;
  title: string;
  fileName: string;
  uploadDate: string;
  transcript: TranscriptSegment[];
  publicUrl?: string; // If hosted externally
  dataUrl?: string; // If local blob (session only)
}

interface AppSettings {
  remoteDatabaseUrl: string; // URL to a JSON file hosted elsewhere (e.g. GitHub Gist)
  cozeApiKey: string;        // PAT (Personal Access Token) for Coze
  cozeBotId: string;         // The Bot ID configured in Coze
  cozeBaseUrl: string;       // API Endpoint (cn or com)
}

// Result structure for Search
interface SearchResult {
  video: VideoData;
  segment: TranscriptSegment;
  isAiMatch?: boolean;
  aiReasoning?: string;
}

// --- Mock Database (LocalStorage Wrapper) ---

const DB_KEYS = {
  USERS: 'app_users',
  SETTINGS: 'app_settings',
  LOCAL_VIDEOS: 'app_local_videos',
  AUTH_REMEMBER: 'app_auth_remember' // New key for remember me
};

const MockDB = {
  init: () => {
    // 1. Initialize Users
    if (!localStorage.getItem(DB_KEYS.USERS)) {
      const defaultAdmin: UserAccount = {
        id: 'admin-1',
        username: 'admin',
        password: 'admin',
        role: 'admin',
        status: 'active'
      };
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify([defaultAdmin]));
    }
    
    // 2. Initialize Settings
    if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
      const defaultSettings: AppSettings = {
        remoteDatabaseUrl: '',
        cozeApiKey: '',
        cozeBotId: '',
        cozeBaseUrl: 'https://api.coze.cn' // Default to China for better compat
      };
      localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    }
  },

  getUsers: (): UserAccount[] => {
    return JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]');
  },

  saveUser: (user: UserAccount) => {
    const users = MockDB.getUsers();
    users.push(user);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  },

  updateUserStatus: (userId: string, status: UserStatus) => {
    const users = MockDB.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, status } : u);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(updated));
  },
  
  getSettings: (): AppSettings => {
    const defaults = { 
        remoteDatabaseUrl: '', 
        cozeApiKey: '', 
        cozeBotId: '',
        cozeBaseUrl: 'https://api.coze.cn'
    };
    const stored = JSON.parse(localStorage.getItem(DB_KEYS.SETTINGS) || '{}');
    return { ...defaults, ...stored };
  },
  
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings));
  },
  
  getLocalVideos: (): VideoData[] => {
    return JSON.parse(localStorage.getItem(DB_KEYS.LOCAL_VIDEOS) || '[]');
  },
  
  saveLocalVideo: (video: VideoData) => {
    const videos = MockDB.getLocalVideos();
    videos.push(video);
    try {
      localStorage.setItem(DB_KEYS.LOCAL_VIDEOS, JSON.stringify(videos));
    } catch (e) {
      alert("本地存储已满！无法保存更多本地视频。");
    }
  },

  // Remember Me Logic
  getRememberedUser: () => {
    const data = localStorage.getItem(DB_KEYS.AUTH_REMEMBER);
    return data ? JSON.parse(data) : null;
  },

  saveRememberedUser: (username: string, password: string) => {
    localStorage.setItem(DB_KEYS.AUTH_REMEMBER, JSON.stringify({ username, password }));
  },

  clearRememberedUser: () => {
    localStorage.removeItem(DB_KEYS.AUTH_REMEMBER);
  }
};

// --- Helper Functions ---

const fileToText = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const timeToSeconds = (timeStr: string): number => {
  const cleanStr = timeStr.replace(',', '.');
  const parts = cleanStr.split(':');
  
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
};

const parseSubtitleFile = (content: string): TranscriptSegment[] => {
  const segments: TranscriptSegment[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const blockRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})(?:[^\n]*\n)([\s\S]*?)(?=\n\n|\n\d+\n|$)/g;
  
  let match;
  while ((match = blockRegex.exec(normalized)) !== null) {
    const startTimeRaw = match[1];
    const endTimeRaw = match[2];
    const textRaw = match[3].trim();
    const cleanText = textRaw.replace(/<[^>]*>/g, ''); 

    if (cleanText) {
      segments.push({
        startTime: startTimeRaw.split(',')[0].split('.')[0], 
        endTime: endTimeRaw,
        text: cleanText,
        seconds: timeToSeconds(startTimeRaw)
      });
    }
  }

  // Fallback for TXT
  if (segments.length === 0 && content.length > 0) {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    lines.forEach((line, idx) => {
      segments.push({
        startTime: `L${idx + 1}`,
        endTime: '',
        text: line,
        seconds: idx * 5 
      });
    });
  }

  return segments;
};

// --- Coze Service (Simulation/Real) ---

const cozeSearch = async (
  query: string, 
  settings: AppSettings, 
  localVideos: VideoData[]
): Promise<SearchResult[]> => {
  // 1. Check Config
  if (!settings.cozeApiKey || !settings.cozeBotId) {
    console.warn("Coze credentials missing. Using local simulation.");
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    return fallbackSearch(query, localVideos);
  }

  // 2. Real API Call
  // Determine endpoint based on settings, default to CN if not set or explicit
  const baseUrl = settings.cozeBaseUrl || 'https://api.coze.cn';
  const endpoint = `${baseUrl}/open_api/v2/chat`;

  console.log(`Connecting to Coze API: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.cozeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify({
        bot_id: settings.cozeBotId,
        user: "web_user_" + Date.now(),
        query: query,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Coze API Error (${response.status}):`, errorText);
      throw new Error(`Coze API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Coze Response Data:", data);
    
    if (data.code !== 0) {
        console.error("Coze API returned logical error:", data.msg);
        let friendlyMsg = data.msg;
        // Detect "not published" error
        if (typeof data.msg === 'string' && (data.msg.includes('not been published') || data.msg.includes('Agent As API'))) {
            friendlyMsg = "Bot 未发布到 'Agent as API' 渠道。\n请前往 Coze 平台 → 发布 → 勾选 'Agent as API' → 点击发布。";
        }
        throw new Error(friendlyMsg);
    }

    const messages = data.messages || [];
    // Find the last 'answer' message
    const answerMessage = [...messages].reverse().find((m: any) => m.type === 'answer');
    
    if (answerMessage) {
       try {
         const content = answerMessage.content;
         console.log("Coze Raw Answer:", content);

         // Check for "No Knowledge Base" specific error in content
         if (content.includes('没有提供') && (content.includes('知识库') || content.includes('knowledge base'))) {
             throw new Error("Coze Bot 未关联知识库。\n请前往 Coze 平台 → 创建知识库并上传数据 → 在 Bot 中添加该知识库 → 重新发布。");
         }

         // Try to extract JSON from markdown block ```json ... ``` or just [...]
         let jsonString = '';
         
         const markdownMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
         if (markdownMatch) {
             jsonString = markdownMatch[1];
         } else {
             // Try to find the first [ and last ]
             const start = content.indexOf('[');
             const end = content.lastIndexOf(']');
             if (start !== -1 && end !== -1 && end > start) {
                 jsonString = content.substring(start, end + 1);
             }
         }

         if (jsonString) {
           const parsed = JSON.parse(jsonString);
           // Map back to local video data
           const mappedResults: SearchResult[] = [];
           
           parsed.forEach((item: any) => {
             // Find video by partial ID match or Title match (case insensitive)
             const vid = localVideos.find(v => 
               v.id === item.videoId || 
               v.title.toLowerCase().includes((item.videoId || '').toLowerCase()) ||
               v.fileName.toLowerCase().includes((item.videoId || '').toLowerCase())
             );
             
             if (vid) {
               // Find closest segment
               const seconds = timeToSeconds(item.timestamp || "00:00:00");
               // Find segment closest to this time
               let closestSegment = vid.transcript[0];
               let minDiff = Infinity;
               
               vid.transcript.forEach(seg => {
                   const diff = Math.abs(seg.seconds - seconds);
                   if (diff < minDiff) {
                       minDiff = diff;
                       closestSegment = seg;
                   }
               });

               mappedResults.push({
                 video: vid,
                 segment: closestSegment,
                 isAiMatch: true,
                 aiReasoning: item.reasoning || item.quote
               });
             }
           });
           return mappedResults;
         } else {
           console.warn("No JSON array found in Coze response text:", content);
           // Fallback for empty array response which is valid JSON but empty result
           if (jsonString === '[]') return [];
         }
       } catch (e) {
         console.error("Failed to parse Coze JSON response", e);
         if (e instanceof Error && e.message.includes('未关联知识库')) {
             throw e; // Propagate specific knowledge base error
         }
       }
    }
    
    return [];

  } catch (error) {
    console.error("Coze Fetch Failed", error);
    alert(`AI 搜索请求失败:\n${error instanceof Error ? error.message : '未知错误'}`);
    return []; 
  }
};

const fallbackSearch = (query: string, localVideos: VideoData[]): SearchResult[] => {
    const keywords = query.toLowerCase().split(' ');
    const results: SearchResult[] = [];
    
    localVideos.forEach(video => {
      video.transcript.forEach(segment => {
        const text = segment.text.toLowerCase();
        if (keywords.some(k => text.includes(k))) {
          results.push({
            video,
            segment,
            isAiMatch: true,
            aiReasoning: `关键词模拟匹配: ${text}`
          });
        }
      });
    });
    return results.slice(0, 5);
}

// --- Components ---

const AuthScreen = ({ onLogin }: { onLogin: (user: UserAccount) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);

  useEffect(() => {
    // Check for remembered user and auto-login if possible
    const saved = MockDB.getRememberedUser();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      setRememberMe(true);
      
      // Attempt auto-login
      const users = MockDB.getUsers();
      const user = users.find(u => u.username === saved.username && u.password === saved.password);
      
      if (user && user.status === 'active') {
          // Small delay for UX transition
          setTimeout(() => {
              onLogin(user);
          }, 800);
      } else {
          setIsAutoLoggingIn(false); // Stop loader if auth failed or status pending
      }
    } else {
        setIsAutoLoggingIn(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const users = MockDB.getUsers();

    if (isRegister) {
      if (users.find(u => u.username === username)) {
        setError('用户名已存在');
        return;
      }
      const newUser: UserAccount = {
        id: Date.now().toString(),
        username,
        password,
        role: 'user',
        status: 'pending'
      };
      MockDB.saveUser(newUser);
      setSuccess('注册成功！请等待管理员审核。');
      setIsRegister(false);
    } else {
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        setError('用户名或密码错误');
      } else if (user.status === 'pending') {
        setError('账号审核中，请联系管理员。');
      } else if (user.status === 'rejected') {
        setError('您的账号已被拒绝。');
      } else {
        if (rememberMe) {
          MockDB.saveRememberedUser(username, password);
        } else {
          MockDB.clearRememberedUser();
        }
        onLogin(user);
      }
    }
  };

  if (isAutoLoggingIn) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-400">正在自动登录...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500 p-3 rounded-full">
            <span className="text-white"><Lock className="w-8 h-8" /></span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          {isRegister ? '申请访问权限' : '安全登录'}
        </h2>
        
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-200 p-3 rounded mb-4 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">用户名</label>
            <input 
              type="text" 
              required
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-indigo-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">密码</label>
            <input 
              type="password" 
              required
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-indigo-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          {!isRegister && (
            <div className="flex items-center">
              <input
                id="remember_me"
                type="checkbox"
                className="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-600 focus:ring-2"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember_me" className="ml-2 text-sm text-slate-400">
                记住账号密码
              </label>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded transition">
            {isRegister ? '注册' : '登录'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-indigo-400 text-sm hover:underline"
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Batch JSON Generator ---

const BatchJsonGenerator = () => {
  const [srtFiles, setSrtFiles] = useState<File[]>([]);
  const [generatedJson, setGeneratedJson] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFiles = async () => {
    if (srtFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus('正在初始化批量解析...');
    
    // Use setTimeout to allow UI to render start state
    setTimeout(async () => {
        try {
          const processedVideos: VideoData[] = [];
          const total = srtFiles.length;

          // Process in chunks to avoid blocking UI
          for (let i = 0; i < total; i++) {
            const file = srtFiles[i];
            
            // Update UI every 5 files or on last file
            if (i % 5 === 0 || i === total - 1) {
                setProgress(Math.round(((i + 1) / total) * 100));
                setStatus(`正在解析 (${i + 1}/${total}): ${file.name}`);
                // Yield to main thread
                await new Promise(r => setTimeout(r, 0));
            }

            try {
                const text = await fileToText(file);
                const transcript = parseSubtitleFile(text);
                const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                
                processedVideos.push({
                id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
                title: fileNameWithoutExt, 
                fileName: fileNameWithoutExt + '.mp4', 
                uploadDate: new Date().toISOString().split('T')[0],
                transcript: transcript
                });
            } catch (err) {
                console.error(`Error parsing file ${file.name}`, err);
            }
          }

          setGeneratedJson(JSON.stringify(processedVideos, null, 2));
          setStatus(`大功告成！成功解析 ${processedVideos.length} / ${total} 个文件。`);
        } catch (e) {
          console.error(e);
          setStatus('批量处理时发生意外错误。');
        } finally {
          setIsProcessing(false);
          setProgress(100);
        }
    }, 100);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedJson);
    setStatus('JSON 内容已复制到剪贴板！');
  };

  const downloadJson = () => {
    if (!generatedJson) return;
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_update_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('数据库文件下载已开始。');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
       const newFiles = Array.from(e.dataTransfer.files).filter(file => {
         const ext = file.name.split('.').pop()?.toLowerCase();
         return ['srt', 'vtt', 'txt'].includes(ext || '');
       });
       
       if (newFiles.length > 0) {
         setSrtFiles(prev => [...prev, ...newFiles]);
         setStatus(`已添加 ${newFiles.length} 个文件，准备生成。`);
       } else {
         setStatus("未检测到有效的字幕文件 (.srt, .vtt, .txt)");
       }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files);
        setSrtFiles(prev => [...prev, ...newFiles]);
        setStatus(`已添加 ${newFiles.length} 个文件，准备生成。`);
    }
  };

  const clearFiles = () => {
      setSrtFiles([]);
      setGeneratedJson('');
      setStatus('');
      setProgress(0);
  };

  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4">
      <div className="text-sm text-slate-400 mb-2">
        <p>批量上传工具：一次性拖拽多个 SRT 文件，自动生成包含所有视频数据的单一 JSON 文件。</p>
      </div>
      
      <div>
        <label className="block text-xs text-slate-400 mb-1">拖拽文件到下方 (支持多选)</label>
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 relative
              ${isDragging 
                ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]' 
                : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50'
              }
            `}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".srt,.vtt,.txt"
            multiple // ENABLE MULTIPLE SELECTION
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3">
             <div className={`p-3 rounded-full ${isDragging ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                {srtFiles.length > 0 ? <span className="text-indigo-400"><Files className="w-6 h-6" /></span> : <span className="text-slate-400"><Upload className="w-6 h-6" /></span>}
             </div>
             <div>
                {srtFiles.length > 0 ? (
                   <div className="text-center">
                       <p className="text-sm font-medium text-indigo-300">已添加 {srtFiles.length} 个文件</p>
                       <p className="text-xs text-slate-500 mt-1">点击生成按钮开始处理</p>
                   </div>
                ) : (
                   <>
                     <p className="text-sm text-slate-300 font-medium">点击此处或拖拽多个文件上传</p>
                     <p className="text-xs text-slate-500 mt-1">支持 .srt, .vtt, .txt (系统自动使用文件名作为标题)</p>
                   </>
                )}
             </div>
          </div>
        </div>
      </div>

      {isProcessing && (
          <div className="w-full bg-slate-800 rounded-full h-2.5 mb-1">
            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
      )}

      <div className="flex gap-2">
        <button 
            onClick={handleProcessFiles}
            disabled={srtFiles.length === 0 || isProcessing}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium text-white transition ${
                srtFiles.length === 0 || isProcessing 
                ? 'bg-slate-700 cursor-not-allowed text-slate-500' 
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
        >
            {isProcessing ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 处理中 ({progress}%)</span> : '批量生成 JSON'}
        </button>
        
        {srtFiles.length > 0 && !isProcessing && (
            <button 
                onClick={clearFiles}
                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20"
                title="清空列表"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        )}
      </div>

      {generatedJson && (
        <div className="relative mt-4 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-green-400 font-mono">生成成功! (包含 {JSON.parse(generatedJson).length} 个视频)</span>
            <div className="flex gap-2">
                <button 
                onClick={copyToClipboard}
                className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white"
                >
                <Copy className="w-3 h-3" /> 复制内容
                </button>
                <button 
                onClick={downloadJson}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white"
                >
                <Download className="w-3 h-3" /> 下载文件
                </button>
            </div>
          </div>
          <div className="bg-black p-4 rounded border border-slate-700 h-24 flex items-center justify-center text-slate-500 text-xs">
              JSON 数据已生成 ({generatedJson.length.toLocaleString()} 字符)。请直接下载或复制。
          </div>
        </div>
      )}
      {status && <p className="text-xs text-indigo-400 mt-2">{status}</p>}
    </div>
  );
};

const AdminPanel = ({ onClose, onDbUpdate }: { onClose: () => void, onDbUpdate: () => void }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'data' | 'coze'>('users');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [settings, setSettings] = useState<AppSettings>(MockDB.getSettings());
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    setUsers(MockDB.getUsers());
  }, []);

  const handleStatusChange = (userId: string, newStatus: UserStatus) => {
    MockDB.updateUserStatus(userId, newStatus);
    setUsers(MockDB.getUsers());
  };

  const handleSaveSettings = () => {
    MockDB.saveSettings(settings);
    setSaveStatus('设置已保存。正在刷新数据...');
    setTimeout(() => {
        setSaveStatus('');
        onDbUpdate(); 
    }, 1500);
  };
  
  const COZE_PROMPT_TEMPLATE = `
角色: 视频搜索助手
任务: 根据用户的问题，在知识库（字幕数据）中查找最相关的视频片段。
输出要求:
1. 必须只返回 JSON 数组格式。
2. 不要包含 markdown 格式 (如 \`\`\`json)，不要包含任何解释性文字。
3. 如果找不到，返回空数组 []。

JSON 格式示例:
[
  {
    "videoId": "视频ID或完整标题",
    "timestamp": "HH:MM:SS",
    "reasoning": "匹配理由(中文)"
  }
]
  `.trim();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400"><Shield className="w-5 h-5" /></span>
            管理后台
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></span>
          </button>
        </div>

        <div className="flex border-b border-slate-700 bg-slate-900/50">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-medium transition ${activeTab === 'users' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
          >
            用户管理
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={`px-6 py-3 text-sm font-medium transition ${activeTab === 'data' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
          >
            数据库配置
          </button>
          <button 
            onClick={() => setActiveTab('coze')}
            className={`px-6 py-3 text-sm font-medium transition ${activeTab === 'coze' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
          >
            Coze AI 设置
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1">
          {activeTab === 'users' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-700 text-slate-400">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">用户名</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3 rounded-tr-lg">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-white">{user.username}</td>
                    <td className="px-4 py-3">{user.role === 'admin' ? '管理员' : '用户'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {user.status === 'active' ? '活跃' : user.status === 'pending' ? '待审核' : '已拒绝'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.role !== 'admin' && (
                        <div className="flex gap-2">
                          {user.status !== 'active' && (
                            <button 
                              onClick={() => handleStatusChange(user.id, 'active')}
                              className="p-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40"
                              title="批准"
                            >
                              <span className="text-green-400"><CheckCircle className="w-4 h-4" /></span>
                            </button>
                          )}
                          {user.status !== 'rejected' && (
                            <button 
                              onClick={() => handleStatusChange(user.id, 'rejected')}
                              className="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40"
                              title="拒绝"
                            >
                              <span className="text-red-400"><XCircle className="w-4 h-4" /></span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-indigo-400"><Cloud className="w-5 h-5" /></span> 远程数据库连接
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  连接到一个外部的 JSON 文件 (例如: GitHub Gist, Raw GitHub URL)。
                  <br/>
                  <span className="text-indigo-400 text-xs">注意：如果输入 GitHub Blob 链接，系统会自动转换为 Raw 链接。</span>
                </p>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="https://..." 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                    value={settings.remoteDatabaseUrl}
                    onChange={e => setSettings({...settings, remoteDatabaseUrl: e.target.value})}
                  />
                  <button 
                    onClick={handleSaveSettings}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm"
                  >
                    保存
                  </button>
                  {saveStatus && <span className="ml-2 text-green-400 text-sm animate-in fade-in slide-in-from-left-2">{saveStatus}</span>}
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-indigo-400"><Files className="w-5 h-5" /></span> 批量数据生成器
                </h3>
                <BatchJsonGenerator />
              </div>
            </div>
          )}

          {activeTab === 'coze' && (
            <div className="space-y-6">
              
              {/* Coze Knowledge Base Setup Guide */}
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6">
                 <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-indigo-400"><BookOpen className="w-5 h-5" /></span> 必读：知识库配置四部曲
                 </h3>
                 <div className="text-sm text-slate-300 space-y-3">
                    <p>Coze 机器人无法直接读取你的前端网页数据。你必须把同样的数据传给它：</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                        <li>
                            <strong className="text-white">生成数据</strong>：使用"数据库配置"中的生成器，生成一个包含所有字幕的 JSON 文件。
                        </li>
                        <li>
                            <strong className="text-white">创建知识库</strong>：前往 Coze 平台，左侧点击 <strong>[+] → 知识库</strong>，新建并上传这个 JSON 文件。
                        </li>
                        <li>
                            <strong className="text-white">关联 Bot</strong>：在你的 Bot 编排页面，点击中间的 <strong>[+] → 知识库</strong>，把刚才创建的库加进去。
                        </li>
                        <li>
                            <strong className="text-white">发布</strong>：最后点击右上角 <strong>发布</strong>，并勾选 <strong>Agent as API</strong>。
                        </li>
                    </ol>
                    <p className="text-xs text-indigo-400 mt-2">
                        如果不做这一步，Bot 会提示 "没有提供知识库"。
                    </p>
                 </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                 <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-indigo-400"><Bot className="w-5 h-5" /></span> API 连接配置
                 </h3>
                 <div className="space-y-4">
                    {/* Region Selector */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Coze 区域 (平台版本)</label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setSettings({...settings, cozeBaseUrl: 'https://api.coze.cn'})}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition ${
                                    settings.cozeBaseUrl === 'https://api.coze.cn'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <Flag className="w-4 h-4" /> 中国版 (api.coze.cn)
                            </button>
                            <button
                                onClick={() => setSettings({...settings, cozeBaseUrl: 'https://api.coze.com'})}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition ${
                                    settings.cozeBaseUrl === 'https://api.coze.com'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <Globe className="w-4 h-4" /> 国际版 (api.coze.com)
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-400 text-sm mb-1">Coze Bot ID</label>
                        <input 
                          type="text" 
                          placeholder="例如：73428..." 
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                          value={settings.cozeBotId}
                          onChange={e => setSettings({...settings, cozeBotId: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-slate-400 text-sm mb-1">个人访问令牌 (PAT)</label>
                        <input 
                          type="password" 
                          placeholder="例如：pat_..." 
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                          value={settings.cozeApiKey}
                          onChange={e => setSettings({...settings, cozeApiKey: e.target.value})}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                        onClick={handleSaveSettings}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded text-sm font-medium"
                        >
                        保存配置
                        </button>
                        {saveStatus && <span className="text-green-400 text-sm animate-in fade-in slide-in-from-left-2">{saveStatus}</span>}
                    </div>
                 </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                 <h3 className="text-lg font-semibold text-white mb-2">Bot 系统提示词模板 (System Prompt)</h3>
                 <p className="text-sm text-slate-400 mb-4">
                    为了确保搜索功能正常，Bot 返回的数据格式必须严格符合要求。请使用下方的 Prompt：
                 </p>
                 <div className="relative">
                    <pre className="bg-black p-4 rounded text-xs text-slate-300 overflow-x-auto border border-slate-700 font-mono whitespace-pre-wrap">
                        {COZE_PROMPT_TEMPLATE}
                    </pre>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(COZE_PROMPT_TEMPLATE);
                            alert("已复制提示词！");
                        }}
                        className="absolute top-2 right-2 p-1 bg-slate-700 hover:bg-slate-600 rounded text-white"
                        title="复制"
                    >
                        <span className="text-white"><Copy className="w-4 h-4" /></span>
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearch, setIsAiSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [dbSource, setDbSource] = useState<'local' | 'remote'>('local');
  const [fetchError, setFetchError] = useState('');
  
  // New State for transcript navigation
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MockDB.init();
    fetchVideos();
  }, []);
  
  // Re-run search when query/mode changes, with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
        handleSearch();
    }, isAiSearch ? 1000 : 300); // Longer debounce for AI
    return () => clearTimeout(timer);
  }, [searchQuery, isAiSearch, videos]);

  // Auto-scroll transcript when active segment changes
  useEffect(() => {
    if (activeSegmentIndex !== -1 && transcriptRef.current) {
        // Try to access the child element safely
        const child = transcriptRef.current.children[activeSegmentIndex] as HTMLElement;
        if (child) {
            child.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [activeSegmentIndex]);

  const fetchVideos = async () => {
    setLoadingVideos(true);
    setFetchError('');
    const settings = MockDB.getSettings();
    let allVideos: VideoData[] = [];
    let remoteUrl = settings.remoteDatabaseUrl?.trim();

    if (remoteUrl) {
      // Fix GitHub Blob URLs to Raw URLs automatically
      if (remoteUrl.includes('github.com') && remoteUrl.includes('/blob/')) {
        remoteUrl = remoteUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }

      try {
        const response = await fetch(remoteUrl);
        if (response.ok) {
          const remoteData = await response.json();
          if (Array.isArray(remoteData)) {
            allVideos = [...remoteData];
            setDbSource('remote');
          } else {
            console.warn("Remote data is not an array");
            setFetchError("远程数据格式错误 (不是 JSON 数组)");
            setDbSource('local');
          }
        } else {
          console.warn(`Fetch failed: ${response.status}`);
          setFetchError(`连接失败: HTTP ${response.status}`);
          setDbSource('local');
        }
      } catch (e) {
        console.warn("无法连接远程数据库，切换至本地模式", e);
        setFetchError("无法连接远程数据库 (请检查跨域/URL)");
        setDbSource('local');
      }
    } else {
      setDbSource('local');
    }

    const localVideos = MockDB.getLocalVideos();
    // Prioritize remote videos, append local videos
    allVideos = [...allVideos, ...localVideos];
    setVideos(allVideos);
    setLoadingVideos(false);
  };
  
  const handleSearch = async () => {
      if (!searchQuery.trim()) {
          setSearchResults([]);
          return;
      }

      if (isAiSearch) {
          setIsSearching(true);
          const settings = MockDB.getSettings();
          const results = await cozeSearch(searchQuery, settings, videos);
          setSearchResults(results);
          setIsSearching(false);
      } else {
          // KEYWORD SEARCH LOGIC UPDATE: AND Logic (Space linkage)
          const keywords = searchQuery.trim().toLowerCase().split(/\s+/);
          
          const results = videos.flatMap(video => 
            video.transcript
              .filter(t => {
                  const text = t.text.toLowerCase();
                  // Returns true only if ALL keywords are present in the text segment
                  return keywords.every(k => text.includes(k));
              })
              .map(t => ({ video, segment: t }))
          );
          setSearchResults(results);
      }
  };

  const handleLogout = () => {
    // Explicitly clear remember me token so we don't auto-login immediately
    MockDB.clearRememberedUser();
    
    setCurrentUser(null);
    setSelectedVideo(null);
    setSearchQuery('');
    setIsAiSearch(false);
    setActiveSegmentIndex(-1);
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };
  
  // New Function for Immediate File Load
  const handleImmediateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedVideo) {
           const url = URL.createObjectURL(file);
           const updatedVideos = videos.map(v => 
             v.id === selectedVideo.id ? { ...v, dataUrl: url } : v
           );
           setVideos(updatedVideos);
           
           // Update current selected object reference to trigger re-render
           const updatedVideo = updatedVideos.find(v => v.id === selectedVideo.id);
           if (updatedVideo) setSelectedVideo(updatedVideo);
      }
  };
  
  const handleSearchResultClick = (result: SearchResult) => {
      setSelectedVideo(result.video);
      
      // Find index for transcript scrolling
      const index = result.video.transcript.findIndex(t => t.startTime === result.segment.startTime);
      if (index !== -1) {
          setActiveSegmentIndex(index);
      }

      setTimeout(() => handleSeek(result.segment.seconds), 100);
  };

  const getVideoSource = (video: VideoData): string | undefined => {
      return video.publicUrl || video.dataUrl;
  };

  if (!currentUser) {
    return <AuthScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <span className="text-white"><Database className="w-5 h-5" /></span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-tight leading-none">视频智搜</h1>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500 font-mono">
                   数据源: {loadingVideos ? '加载中...' : dbSource === 'remote' ? '远程' : '本地'}
                 </span>
                 {fetchError && (
                   <span className="text-[10px] text-red-400 bg-red-900/20 px-1 rounded flex items-center gap-1" title={fetchError}>
                     <AlertCircle className="w-3 h-3" /> 连接错误
                   </span>
                 )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <span className="text-slate-400"><User className="w-4 h-4" /></span>
              <span className="text-sm font-medium text-slate-300">{currentUser.username}</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-400 uppercase">{currentUser.role === 'admin' ? '管理员' : '用户'}</span>
            </div>

            {currentUser.role === 'admin' && (
              <button 
                onClick={() => setShowAdmin(true)}
                className="p-2 hover:bg-slate-800 rounded-full text-indigo-400 hover:text-indigo-300 transition"
                title="管理后台"
              >
                <span className="text-indigo-400 hover:text-indigo-300"><Settings className="w-5 h-5" /></span>
              </button>
            )}
            
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
              title="退出登录"
            >
              <span className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {!loadingVideos && videos.length === 0 && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 flex items-start gap-3">
             <span className="text-yellow-200 mt-0.5 shrink-0"><Database className="w-5 h-5" /></span>
             <div>
               <h3 className="font-bold">数据库为空</h3>
               <p className="text-sm opacity-90 mt-1">
                 未加载任何视频。
                 {currentUser.role === 'admin' 
                    ? " 请前往管理后台 → 数据库配置，配置远程 URL 或批量生成本地内容。" 
                    : " 请联系管理员上传内容。"}
               </p>
               {fetchError && <p className="text-xs text-red-300 mt-2 font-mono bg-red-900/20 p-2 rounded">{fetchError}</p>}
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Search */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">内容搜索</h2>
                  <button 
                    onClick={() => setIsAiSearch(!isAiSearch)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                        isAiSearch 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]' 
                        : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <span className={isAiSearch ? 'text-white' : 'text-slate-400'}><Sparkles className="w-3 h-3" /></span>
                    {isAiSearch ? 'AI 模式' : '关键词模式'}
                  </button>
              </div>
              
              <div className="relative">
                {isSearching ? (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"><Loader2 className="w-5 h-5 animate-spin" /></span>
                ) : (
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${isAiSearch ? 'text-indigo-400' : 'text-slate-400'}`}><Search className="w-5 h-5" /></span>
                )}
                <input 
                  type="text" 
                  placeholder={isAiSearch ? "输入问题 (例如: '如何处理投诉?')" : "搜索视频对话内容..."}
                  className={`w-full bg-slate-900 border pl-10 pr-4 py-3 rounded-lg text-white outline-none transition ${
                      isAiSearch 
                      ? 'border-indigo-500/50 focus:ring-2 focus:ring-indigo-500' 
                      : 'border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  }`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {!isAiSearch && (
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      小提示：您可以输入多个关键词，中间用空格分割，比如：<span className="text-indigo-400 font-medium bg-indigo-900/20 px-1 rounded mx-1">未来十年 确定性 普通人 机会</span>，搜索结果更精准（中间一定要有空格哦）。
                  </p>
              )}
            </div>

            <div className="space-y-4">
              {searchQuery.length > 1 && searchResults.length === 0 && !isSearching && (
                 <div className="text-center py-10 text-slate-500">
                   未找到与 "{searchQuery}" 相关的内容
                 </div>
              )}
              
              {searchResults.map((result, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSearchResultClick(result)}
                  className={`border p-4 rounded-lg cursor-pointer transition group relative overflow-hidden ${
                      result.isAiMatch 
                      ? 'bg-indigo-900/10 border-indigo-500/30 hover:bg-indigo-900/20' 
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50'
                  }`}
                >
                  {result.isAiMatch && (
                      <div className="absolute top-0 right-0 p-1">
                          <span className="text-indigo-400 opacity-50"><Sparkles className="w-3 h-3" /></span>
                      </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        result.isAiMatch ? 'bg-indigo-500 text-white' : 'text-indigo-400 bg-indigo-400/10'
                    }`}>
                      {result.segment.startTime}
                    </span>
                    <div className="flex items-center gap-2">
                         {result.video.publicUrl && (
                             <span title="远程视频" className="text-sky-400">
                               <Cloud className="w-3 h-3" />
                             </span>
                         )}
                         {!result.video.publicUrl && (
                             <span title="本地视频" className="text-slate-500">
                               <HardDrive className="w-3 h-3" />
                             </span>
                         )}
                    </div>
                  </div>
                  
                  {/* AI Reasoning display */}
                  {result.aiReasoning && (
                      <div className="mb-2 text-xs text-indigo-300 italic border-l-2 border-indigo-500 pl-2">
                          "{result.aiReasoning}"
                      </div>
                  )}
                  
                  <p className="text-slate-200 text-sm leading-relaxed mb-2">
                    "... <span className={isAiSearch ? '' : "text-white font-medium bg-indigo-600/20"}>{result.segment.text}</span> ..."
                  </p>
                  <p className="text-xs text-slate-500 truncate">{result.video.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Player */}
          <div className="lg:col-span-2">
            {selectedVideo ? (
              <div className="bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 sticky top-24">
                <div className="aspect-video bg-black relative flex items-center justify-center">
                  {getVideoSource(selectedVideo) ? (
                    <video 
                      ref={videoRef}
                      src={getVideoSource(selectedVideo)} 
                      controls 
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="text-center p-8 max-w-md">
                      <div className="bg-slate-800 p-4 rounded-full inline-block mb-4">
                        <span className="text-indigo-400"><HardDrive className="w-8 h-8" /></span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">需要本地文件</h3>
                      <p className="text-slate-400 text-sm mb-6">
                        此视频未在线托管。请从您的电脑中选择文件 
                        <strong> {selectedVideo.fileName}</strong> 进行播放。
                      </p>
                      
                      <div className="space-y-3">
                         <div className="flex justify-center">
                             <input 
                                type="file" 
                                accept="video/*"
                                onChange={handleImmediateFileSelect}
                                className="block w-full text-sm text-slate-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-xs file:font-semibold
                                file:bg-indigo-600 file:text-white
                                hover:file:bg-indigo-500
                                cursor-pointer bg-slate-900 rounded-full border border-slate-700 max-w-[250px]"
                            />
                         </div>
                         <p className="text-[10px] text-slate-500">选择文件后立即播放</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 bg-slate-800">
                  <div className="flex justify-between items-start mb-2">
                     <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                     {selectedVideo.publicUrl && (
                         <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-1 rounded flex items-center gap-1">
                             <Cloud className="w-3 h-3" /> 远程资源
                         </span>
                     )}
                  </div>
                  
                  <div className="flex gap-4 text-sm text-slate-400 mb-6">
                    <span>上传时间: {selectedVideo.uploadDate}</span>
                    <span>ID: {selectedVideo.id}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">全文记录</h3>
                      <p className="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-500/30">
                          提示：上传对应视频后点击搜索结果或者下方文案即可跳转到视频对应的时间点。
                      </p>
                  </div>

                  <div 
                    ref={transcriptRef}
                    className="h-64 overflow-y-auto space-y-1 pr-2 custom-scrollbar scroll-smooth"
                  >
                    {selectedVideo.transcript.map((t, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                            setActiveSegmentIndex(i);
                            if (getVideoSource(selectedVideo)) handleSeek(t.seconds);
                        }}
                        className={`flex gap-4 p-2 rounded cursor-pointer group text-sm transition-colors border-l-2 ${
                           activeSegmentIndex === i 
                           ? 'bg-indigo-600/20 border-indigo-500' 
                           : 'border-transparent hover:bg-slate-700'
                        }`}
                      >
                        <span className={`font-mono min-w-[50px] ${
                            activeSegmentIndex === i ? 'text-indigo-300 font-bold' : 'text-slate-500 group-hover:text-indigo-400'
                        }`}>
                          {t.startTime}
                        </span>
                        <p className={`${
                            activeSegmentIndex === i ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        }`}>
                          {t.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-800/30 rounded-xl border border-slate-800 border-dashed text-slate-500">
                <span className="text-slate-500 opacity-20"><Play className="w-16 h-16 mb-4" /></span>
                <p>点击左侧搜索结果开始播放</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} onDbUpdate={fetchVideos} />}
    </div>
  );
};

// Export App component for Vite local development
export default App;