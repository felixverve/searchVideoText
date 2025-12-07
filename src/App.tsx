import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

import { 
  Search, 
  Play, 
  Upload, 
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
  Check,
  Users,
  Info,
  Clock,
  FileVideo
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
  note?: string; 
}

interface TranscriptSegment {
  startTime: string; 
  endTime: string;
  text: string;
  seconds: number; 
}

interface VideoData {
  id: string;
  title: string;
  fileName: string;
  uploadDate: string;
  transcript: TranscriptSegment[];
  publicUrl?: string; 
  dataUrl?: string; 
}

interface AppSettings {
  remoteDatabaseUrl: string; 
  cozeApiKey: string;        
  cozeBotId: string;         
  cozeBaseUrl: string;       
  // New Supabase Config
  supabaseUrl: string;
  supabaseKey: string;
}

interface SearchResult {
  video: VideoData;
  segment: TranscriptSegment;
  isAiMatch?: boolean;
  aiReasoning?: string;
  aiQuote?: string; // Added to support AI quote separation
  context?: { prev: string; next: string }; // 上下文信息
}

// --- GLOBAL CONFIGURATION ---
// ⚠️ 重要：为了让其他用户访问时能直接登录，请将你的 Supabase 配置填写在这里
// 这样别人打开网页时，会自动使用这些配置，无需再次手动输入。
const GLOBAL_APP_CONFIG: AppSettings = {
  // Supabase 项目地址 (例如: https://xyz.supabase.co)
  supabaseUrl: 'https://euikwoyohattxfxmrzgt.supabase.co', 
  
  // Supabase API Key (anon/public key)
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1aWt3b3lvaGF0dHhmeG1yemd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODk4NjgsImV4cCI6MjA4MDQ2NTg2OH0.ygURWUh59iYrth-Or4zgNmDl_ygis1qmTkSLO7SpTZE',
  
  // Coze 配置 (可选，如果不填则无法使用 AI 搜索)
  cozeApiKey: 'pat_vv2A48hplarHOQclQigwn4HZbZQWolKBIxnsJOhevP2R4gtzzfVOQ7R4pTJqXqmo',
  cozeBotId: '7579927339174690822',
  cozeBaseUrl: 'https://api.coze.cn',
  
  // 远程 JSON 地址 (可选)
  remoteDatabaseUrl: '' 
};

// --- Mock Database (LocalStorage Wrapper) ---

const DB_KEYS = {
  USERS: 'app_users',
  SETTINGS: 'app_settings',
  LOCAL_VIDEOS: 'app_local_videos',
  AUTH_REMEMBER: 'app_auth_remember' 
};

const MockDB = {
  init: () => {
    try {
      if (!localStorage.getItem(DB_KEYS.USERS)) {
        const defaultAdmin: UserAccount = {
          id: 'admin-1',
          username: 'admin',
          password: 'admin',
          role: 'admin',
          status: 'active',
          note: 'Super Admin'
        };
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify([defaultAdmin]));
      }
      
      // 注意：这里不再强制初始化 SETTINGS 为空对象，
      // 而是依赖 getSettings 中的 GLOBAL_APP_CONFIG 回退机制
    } catch (e) {
      console.error("Local Storage Init Error:", e);
    }
  },

  getUsers: (): UserAccount[] => {
    try {
      return JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]');
    } catch {
      return [];
    }
  },

  saveUser: (user: UserAccount) => {
    const users = MockDB.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
        users[idx] = user;
    } else {
        users.push(user);
    }
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  },

  updateUserStatus: (userId: string, status: UserStatus) => {
    const users = MockDB.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, status } : u);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(updated));
  },

  updateUserNote: (userId: string, note: string) => {
    const users = MockDB.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, note } : u);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(updated));
  },
  
  getSettings: (): AppSettings => {
    try {
        const storedStr = localStorage.getItem(DB_KEYS.SETTINGS);
        const local = storedStr ? JSON.parse(storedStr) : {};
        
        // 核心逻辑：如果本地存储没有值，则使用代码中的全局配置 (GLOBAL_APP_CONFIG)
        // 这样即使换了浏览器，只要代码里填了，就能自动连上数据库
        return { 
            remoteDatabaseUrl: local.remoteDatabaseUrl || GLOBAL_APP_CONFIG.remoteDatabaseUrl || '',
            cozeApiKey: local.cozeApiKey || GLOBAL_APP_CONFIG.cozeApiKey || '',
            cozeBotId: local.cozeBotId || GLOBAL_APP_CONFIG.cozeBotId || '',
            cozeBaseUrl: local.cozeBaseUrl || GLOBAL_APP_CONFIG.cozeBaseUrl || 'https://api.coze.cn',
            supabaseUrl: local.supabaseUrl || GLOBAL_APP_CONFIG.supabaseUrl || '',
            supabaseKey: local.supabaseKey || GLOBAL_APP_CONFIG.supabaseKey || ''
        };
    } catch (e) {
        console.error("Settings Load Error, using defaults:", e);
        return GLOBAL_APP_CONFIG;
    }
  },
  
  saveSettings: (settings: AppSettings) => {
    try {
        localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
  },
  
  getLocalVideos: (): VideoData[] => {
    try {
        return JSON.parse(localStorage.getItem(DB_KEYS.LOCAL_VIDEOS) || '[]');
    } catch {
        return [];
    }
  },
  
  saveLocalVideo: (video: VideoData) => {
    const videos = MockDB.getLocalVideos();
    videos.push(video);
    try {
      localStorage.setItem(DB_KEYS.LOCAL_VIDEOS, JSON.stringify(videos));
    } catch (e) {
      console.error("本地存储已满！无法保存更多本地视频。", e);
    }
  },

  getRememberedUser: () => {
    try {
        const data = localStorage.getItem(DB_KEYS.AUTH_REMEMBER);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
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

// --- Supabase Service ---

const SupabaseService = {
    getClient: () => {
        const settings = MockDB.getSettings();
        // Return null immediately if keys are missing to avoid console errors
        if (!settings.supabaseUrl || !settings.supabaseKey) return null;
        
        let url = settings.supabaseUrl.trim();
        
        // 1. Intelligent Fix: Detect if user pasted Dashboard URL instead of API URL
        if (url.includes('supabase.com/dashboard/project/')) {
            const parts = url.split('project/');
            if (parts[1]) {
                const projectId = parts[1].split('/')[0];
                url = `https://${projectId}.supabase.co`;
                console.log("Auto-corrected Supabase URL from Dashboard to API format.");
            }
        }

        // 2. Ensure https:// protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }
        
        // 3. Remove all trailing slashes
        url = url.replace(/\/+$/, "");
        
        const key = settings.supabaseKey.trim();

        try {
            return createClient(url, key);
        } catch (e) {
            console.error("Supabase Init Failed (Invalid URL/Key):", e);
            return null;
        }
    },

    getAllVideos: async (): Promise<VideoData[]> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('videos')
                .select('id, title, file_name, upload_date, public_url');
                
            if (error) {
                console.warn("Fetch All Videos Error:", error.message);
                return [];
            }
            return data.map((v: any) => ({
                id: v.id,
                title: v.title,
                fileName: v.file_name,
                uploadDate: v.upload_date,
                publicUrl: v.public_url,
                transcript: [] 
            }));
        } catch (e) {
            console.error("Connection Error during getAllVideos:", e);
            return [];
        }
    },

    search: async (query: string): Promise<SearchResult[]> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return [];
        
        const keywords = query.trim().split(/\s+/).map(k => k.toLowerCase()).filter(k => k);
        if (keywords.length === 0) return [];
        
        try {
            // Build OR filter: text.ilike.%k1%,text.ilike.%k2%
            const orFilter = keywords.map(k => `text.ilike.%${k}%`).join(',');

            // 1. Fetch segments matching ANY keyword
            // Limit to 100 to avoid performance issues when fetching context for too many items
            const { data, error } = await supabase
                .from('transcripts')
                .select(`*, videos (id, title, file_name, upload_date, public_url)`)
                .or(orFilter)
                .order('video_id', { ascending: true })
                .order('seconds', { ascending: true })
                .limit(100);

            if (error) { 
                console.warn("Supabase Search Error:", error.message); 
                return []; 
            }
            if (!data || data.length === 0) return [];

            // 2. Fetch Context (Previous 6 lines and Next 6 lines)
            // We assume IDs are sequential for imports. We collect all needed IDs.
            const neededIds = new Set<number>();
            data.forEach((row: any) => {
                for (let i = 1; i <= 6; i++) {
                    neededIds.add(row.id - i);
                    neededIds.add(row.id + i);
                }
            });

            // Batch fetch neighbor rows
            const { data: neighbors } = await supabase
                .from('transcripts')
                .select('id, text, video_id')
                .in('id', Array.from(neededIds));
            
            const neighborMap = new Map<number, any>();
            if (neighbors) {
                neighbors.forEach((n: any) => neighborMap.set(n.id, n));
            }

            // 3. Client-side Aggregation and Result Building
            const videoGroups = new Map<string, {
                video: any,
                segments: any[],
                matchedKeywords: Set<string>
            }>();

            data.forEach((row: any) => {
                const vid = row.video_id;
                if (!videoGroups.has(vid)) {
                    videoGroups.set(vid, {
                        video: row.videos,
                        segments: [],
                        matchedKeywords: new Set()
                    });
                }
                
                const group = videoGroups.get(vid)!;
                const textLower = (row.text || '').toLowerCase();
                
                keywords.forEach(k => {
                    if (textLower.includes(k)) {
                        group.matchedKeywords.add(k);
                    }
                });
                group.segments.push(row);
            });

            const results: SearchResult[] = [];
            
            // Filter: Video must contain ALL keywords
            for (const group of videoGroups.values()) {
                const hasAllKeywords = keywords.every(k => group.matchedKeywords.has(k));
                
                if (hasAllKeywords) {
                    group.segments.forEach(seg => {
                        // Build Context
                        const prevLines: string[] = [];
                        const nextLines: string[] = [];

                        // Collect previous 6 lines (if they belong to same video)
                        for (let i = 6; i >= 1; i--) {
                            const n = neighborMap.get(seg.id - i);
                            if (n && n.video_id === seg.video_id) {
                                prevLines.push(n.text);
                            }
                        }
                        
                        // Collect next 6 lines (if they belong to same video)
                        for (let i = 1; i <= 6; i++) {
                            const n = neighborMap.get(seg.id + i);
                            if (n && n.video_id === seg.video_id) {
                                nextLines.push(n.text);
                            }
                        }

                        results.push({
                            video: {
                                id: group.video.id,
                                title: group.video.title,
                                fileName: group.video.file_name,
                                uploadDate: group.video.upload_date,
                                publicUrl: group.video.public_url,
                                transcript: [], 
                            },
                            segment: {
                                startTime: seg.start_time,
                                endTime: seg.end_time,
                                text: seg.text,
                                seconds: seg.seconds
                            },
                            isAiMatch: true,
                            aiReasoning: `多词联动匹配: ${keywords.join(' + ')}`,
                            context: {
                                prev: prevLines.join(' '),
                                next: nextLines.join(' ')
                            }
                        });
                    });
                }
            }

            return results;
        } catch (e) {
             console.error("Connection Error during search:", e);
             return [];
        }
    },

    fetchTranscript: async (videoId: string): Promise<TranscriptSegment[]> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('transcripts')
                .select('*')
                .eq('video_id', videoId)
                .order('seconds', { ascending: true });
                
            if (error) {
                console.warn("Fetch Transcript Error:", error.message);
                return [];
            }
            return data.map((item: any) => ({
                startTime: item.start_time,
                endTime: item.end_time,
                text: item.text,
                seconds: item.seconds
            }));
        } catch (e) {
            console.error("Connection Error during transcript fetch:", e);
            return [];
        }
    },
    
    uploadData: async (videos: VideoData[], onProgress: (msg: string) => void) => {
        const supabase = SupabaseService.getClient();
        if (!supabase) throw new Error("Supabase 未配置或 URL 格式错误");

        for (let i = 0; i < videos.length; i++) {
            const v = videos[i];
            onProgress(`正在上传视频 (${i + 1}/${videos.length}): ${v.title}`);
            
            // 1. Upsert video metadata
            const { error: vError } = await supabase.from('videos').upsert({
                id: v.id,
                title: v.title,
                file_name: v.fileName,
                upload_date: v.uploadDate,
                public_url: v.publicUrl || null
            });
            if (vError) throw new Error(`上传视频 ${v.title} 失败: ${vError.message}`);

            // 2. CRITICAL FIX: Delete existing transcripts for this video to prevent duplicates
            // We delete all transcripts for this video_id before inserting new ones.
            const { error: delError } = await supabase
                .from('transcripts')
                .delete()
                .eq('video_id', v.id);
            
            if (delError) {
                console.warn(`清理旧字幕失败 (Video ID: ${v.id}):`, delError.message);
            }

            // 3. Insert new transcripts
            const transcriptRows = v.transcript.map(t => ({
                video_id: v.id,
                start_time: t.startTime,
                end_time: t.endTime,
                text: t.text,
                seconds: t.seconds
            }));
            const chunkSize = 1000;
            for (let j = 0; j < transcriptRows.length; j += chunkSize) {
                const chunk = transcriptRows.slice(j, j + chunkSize);
                const { error: tError } = await supabase.from('transcripts').insert(chunk);
                if (tError) throw new Error(`上传字幕失败: ${tError.message}`);
            }
        }
        onProgress("上传完成！");
    },

    getUsers: async (): Promise<UserAccount[]> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase.from('app_users').select('*').order('username');
            if (error) { 
                console.warn("Fetch Users Error:", error.message); 
                return []; 
            }
            return data as UserAccount[];
        } catch (e) {
            console.error("Connection Error during getUsers:", e);
            return [];
        }
    },

    loginUser: async (username: string, password: string): Promise<UserAccount | null> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();
            
            if (error) {
                console.warn("Login Query Error:", error.message);
                return null;
            }
            return data as UserAccount;
        } catch (e) {
             console.error("Connection Error during login:", e);
             return null;
        }
    },

    registerUser: async (user: UserAccount): Promise<void> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) throw new Error("DB not connected");
        
        const { error } = await supabase.from('app_users').insert({
            id: user.id,
            username: user.username,
            password: user.password,
            role: user.role,
            status: user.status,
            note: user.note
        });
        if (error) throw error;
    },

    updateUserStatus: async (userId: string, status: UserStatus): Promise<void> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return;
        await supabase.from('app_users').update({ status }).eq('id', userId);
    },

    updateUserNote: async (userId: string, note: string): Promise<void> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) return;
        await supabase.from('app_users').update({ note }).eq('id', userId);
    },

    migrateUsers: async (users: UserAccount[]): Promise<void> => {
        const supabase = SupabaseService.getClient();
        if (!supabase) throw new Error("DB not connected");
        
        for (const u of users) {
             const { error } = await supabase.from('app_users').upsert({
                id: u.id,
                username: u.username,
                password: u.password,
                role: u.role,
                status: u.status,
                note: u.note
             });
             if (error) console.warn("Failed to migrate user " + u.username, error);
        }
    }
};

// --- Coze Service ---

const cozeSearch = async (
  query: string, 
  settings: AppSettings, 
  localVideos: VideoData[]
): Promise<SearchResult[]> => {
  if (!settings.cozeApiKey || !settings.cozeBotId) {
    console.warn("Coze credentials missing. Using local simulation.");
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    return fallbackSearch(query, localVideos);
  }

  const baseUrl = settings.cozeBaseUrl || 'https://api.coze.cn';
  const endpoint = `${baseUrl}/open_api/v2/chat`;

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
      throw new Error(`Coze API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
        let friendlyMsg = data.msg;
        if (typeof data.msg === 'string' && (data.msg.includes('not been published') || data.msg.includes('Agent As API'))) {
            friendlyMsg = "Bot 未发布到 'Agent as API' 渠道。";
        }
        throw new Error(friendlyMsg);
    }

    const messages = data.messages || [];
    const answerMessage = [...messages].reverse().find((m: any) => m.type === 'answer');
    
    if (answerMessage) {
         const content = answerMessage.content;
         let jsonString = '';
         const markdownMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
         if (markdownMatch) {
             jsonString = markdownMatch[1];
         } else {
             const start = content.indexOf('[');
             const end = content.lastIndexOf(']');
             if (start !== -1 && end !== -1 && end > start) {
                 jsonString = content.substring(start, end + 1);
             }
         }

         if (jsonString) {
           const parsed = JSON.parse(jsonString);
           const mappedResults: SearchResult[] = [];
           
           parsed.forEach((item: any) => {
             const vid = localVideos.find(v => 
               v.id === item.videoId || 
               v.title.toLowerCase().includes((item.videoId || '').toLowerCase()) ||
               (v.fileName && v.fileName.toLowerCase().includes((item.videoId || '').toLowerCase()))
             );
             
             if (vid) {
               const seconds = timeToSeconds(item.timestamp || "00:00:00");
               let closestSegment: TranscriptSegment;
               
               if (vid.transcript && vid.transcript.length > 0) {
                   closestSegment = vid.transcript[0];
                   let minDiff = Infinity;
                   vid.transcript.forEach(seg => {
                       const diff = Math.abs(seg.seconds - seconds);
                       if (diff < minDiff) {
                           minDiff = diff;
                           closestSegment = seg;
                       }
                   });
               } else {
                   closestSegment = {
                       startTime: item.timestamp || "00:00:00",
                       endTime: "",
                       text: item.quote || "AI 智能定位片段 (点击加载详情)",
                       seconds: seconds
                   };
               }

               mappedResults.push({
                 video: vid,
                 segment: closestSegment,
                 isAiMatch: true,
                 aiReasoning: item.reasoning || item.thought,
                 aiQuote: item.quote || item.content 
               });
             }
           });
           return mappedResults;
         }
    }
    return [];
  } catch (error) {
    console.error("Coze Fetch Failed", error);
    return []; 
  }
};

const fallbackSearch = (query: string, localVideos: VideoData[]): SearchResult[] => {
    const keywords = query.toLowerCase().trim().split(/\s+/).filter(k => k);
    if (keywords.length === 0) return [];

    const results: SearchResult[] = [];
    
    localVideos.forEach(video => {
      if (!video.transcript || video.transcript.length === 0) return;

      const fullText = video.transcript.map(t => t.text).join(' ').toLowerCase();
      const hasAllKeywords = keywords.every(k => fullText.includes(k));

      if (hasAllKeywords) {
          video.transcript.forEach((segment, idx) => {
            const text = segment.text.toLowerCase();
            const matchesAny = keywords.some(k => text.includes(k));

            if (matchesAny) {
              // Get context: Increased to 6 previous and 6 next segments
              const prevSegments = video.transcript.slice(Math.max(0, idx - 6), idx);
              const prev = prevSegments.map(s => s.text).join(' ');
              
              const nextSegments = video.transcript.slice(idx + 1, Math.min(video.transcript.length, idx + 7));
              const next = nextSegments.map(s => s.text).join(' ');
              
              results.push({
                video,
                segment,
                isAiMatch: true,
                aiReasoning: `全匹配视频中的片段 (包含: ${keywords.filter(k => text.includes(k)).join(', ')})`,
                context: { prev, next }
              });
            }
          });
      }
    });
    return results;
}

// --- Components ---

const AuthScreen = ({ onLogin }: { onLogin: (user: UserAccount) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);

  const attemptLogin = async (usr: string, pwd: string, isAuto: boolean) => {
    let user: UserAccount | null = null;
    
    const settings = MockDB.getSettings();
    if (settings.supabaseUrl && settings.supabaseKey) {
        try {
            user = await SupabaseService.loginUser(usr, pwd);
        } catch (e) {
            console.error("Supabase Login Error", e);
        }
    }

    if (!user) {
        const localUsers = MockDB.getUsers();
        user = localUsers.find(u => u.username === usr && u.password === pwd) || null;
    }

    if (!user) {
        if (!isAuto) setError('用户名或密码错误 (或网络连接失败)');
        if (isAuto) setIsAutoLoggingIn(false);
    } else if (user.status === 'pending') {
        if (!isAuto) setError('账号审核中，请联系管理员。');
        if (isAuto) setIsAutoLoggingIn(false);
    } else if (user.status === 'rejected') {
        if (!isAuto) setError('您的账号已被拒绝。');
        if (isAuto) setIsAutoLoggingIn(false);
    } else {
        if (!isAuto) {
            MockDB.saveRememberedUser(usr, pwd);
        }
        onLogin(user);
    }
  };

  useEffect(() => {
    const saved = MockDB.getRememberedUser();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      attemptLogin(saved.username, saved.password, true);
    } else {
        setIsAutoLoggingIn(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (isRegister) {
        const newUser: UserAccount = {
            id: 'u_' + Date.now().toString(),
            username,
            password,
            role: 'user',
            status: 'pending',
            note: ''
        };
        
        const settings = MockDB.getSettings();
        try {
             if (settings.supabaseUrl && settings.supabaseKey) {
                 await SupabaseService.registerUser(newUser);
             } else {
                 const localUsers = MockDB.getUsers();
                 if (localUsers.find(u => u.username === username)) {
                    setError('用户名已存在');
                    return;
                 }
                 MockDB.saveUser(newUser);
             }
             setSuccess('注册成功！请等待管理员审核。');
             setIsRegister(false);
        } catch (e) {
             setError('注册失败: ' + (e instanceof Error ? e.message : '未知错误'));
        }
    } else {
        attemptLogin(username, password, false);
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
      <div className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
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
              type="text" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              value={username} onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">密码</label>
            <input 
              type="password" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded transition">
            {isRegister ? '注册' : '登录'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-indigo-400 text-sm hover:underline">
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BatchJsonGenerator = ({ onDataReady }: { onDataReady?: (data: VideoData[]) => void }) => {
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
    
    setTimeout(async () => {
        try {
          const processedVideos: VideoData[] = [];
          const total = srtFiles.length;

          for (let i = 0; i < total; i++) {
            const file = srtFiles[i];
            if (i % 5 === 0 || i === total - 1) {
                setProgress(Math.round(((i + 1) / total) * 100));
                setStatus(`正在解析 (${i + 1}/${total}): ${file.name}`);
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
            } catch (err) { console.error(err); }
          }
          const jsonStr = JSON.stringify(processedVideos, null, 2);
          setGeneratedJson(jsonStr);
          if (onDataReady) onDataReady(processedVideos);
          setStatus(`大功告成！成功解析 ${processedVideos.length} / ${total} 个文件。`);
        } catch (e) { setStatus('批量处理时发生意外错误。'); } 
        finally { setIsProcessing(false); setProgress(100); }
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
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
       const newFiles = Array.from(e.dataTransfer.files).filter(f => ['srt', 'vtt', 'txt'].includes(f.name.split('.').pop()?.toLowerCase() || ''));
       if (newFiles.length > 0) {
         setSrtFiles(prev => [...prev, ...newFiles]);
         setStatus(`已添加 ${newFiles.length} 个文件，准备生成。`);
       }
    }
  };

  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">1. 拖拽文件生成数据 (支持多选)</label>
        <div 
            onDragOver={e => {e.preventDefault(); setIsDragging(true);}}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all relative
              ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/50'}
            `}
        >
          <input type="file" ref={fileInputRef} accept=".srt,.vtt,.txt" multiple onChange={e => {
              if (e.target.files?.length) {
                  setSrtFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  setStatus(`已添加 ${e.target.files!.length} 个文件。`);
              }
          }} className="hidden" />
          <div className="flex flex-col items-center gap-2">
             <div className="p-2 bg-slate-800 rounded-full text-slate-400"><Upload className="w-5 h-5" /></div>
             <p className="text-xs text-slate-400">{srtFiles.length > 0 ? `已选 ${srtFiles.length} 个文件` : '点击或拖拽 SRT/TXT 文件'}</p>
          </div>
        </div>
      </div>

      {isProcessing && (
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleProcessFiles} disabled={!srtFiles.length || isProcessing}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium text-white transition ${!srtFiles.length || isProcessing ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {isProcessing ? '处理中...' : '开始解析'}
        </button>
        {srtFiles.length > 0 && !isProcessing && (
            <button onClick={() => {setSrtFiles([]); setGeneratedJson('');}} className="px-3 py-2 bg-slate-800 text-slate-400 rounded hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
            </button>
        )}
      </div>

      {generatedJson && (
        <div className="mt-2 p-3 bg-black/30 rounded border border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-green-400 font-mono">成功生成!</span>
            <div className="flex gap-2">
                <button onClick={copyToClipboard} className="text-xs text-slate-400 hover:text-white"><Copy className="w-3 h-3" /></button>
                <button onClick={downloadJson} className="text-xs text-indigo-400 hover:text-indigo-300"><Download className="w-3 h-3" /></button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 truncate">JSON 大小: {(generatedJson.length/1024).toFixed(2)} KB</p>
        </div>
      )}
      {status && <p className="text-xs text-indigo-400 mt-1">{status}</p>}
    </div>
  );
};

const AdminPanel = ({ onClose, onDbUpdate }: { onClose: () => void, onDbUpdate: () => void }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'data' | 'coze'>('users');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [settings, setSettings] = useState<AppSettings>(MockDB.getSettings());
  const [jsonSaveStatus, setJsonSaveStatus] = useState('');
  const [supabaseSaveStatus, setSupabaseSaveStatus] = useState('');
  const [cozeSaveStatus, setCozeSaveStatus] = useState('');
  
  // Migration State
  const [migrationData, setMigrationData] = useState<VideoData[] | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationResult, setMigrationResult] = useState<'success' | 'error' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const [isUserMigrating, setIsUserMigrating] = useState(false);
  const [userMigrationMsg, setUserMigrationMsg] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    let userList: UserAccount[] = [];
    if (settings.supabaseUrl && settings.supabaseKey) {
        userList = await SupabaseService.getUsers();
    } 
    if (userList.length === 0 && (!settings.supabaseUrl || !settings.supabaseKey)) {
        userList = MockDB.getUsers();
    }
    setUsers(userList);
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    if (settings.supabaseUrl && settings.supabaseKey) {
        await SupabaseService.updateUserStatus(userId, newStatus);
    } else {
        MockDB.updateUserStatus(userId, newStatus);
    }
    fetchUsers();
  };
  
  const handleNoteBlur = async (userId: string, newNote: string) => {
    if (settings.supabaseUrl && settings.supabaseKey) {
        await SupabaseService.updateUserNote(userId, newNote);
    } else {
        MockDB.updateUserNote(userId, newNote);
    }
    fetchUsers();
  };

  const handleSaveJsonSettings = () => {
    MockDB.saveSettings(settings);
    setJsonSaveStatus('success');
    setTimeout(() => { setJsonSaveStatus(''); onDbUpdate(); }, 2000);
  };

  const handleSaveSupabaseSettings = () => {
    MockDB.saveSettings(settings);
    setSupabaseSaveStatus('success');
    setTimeout(() => { 
        setSupabaseSaveStatus(''); 
        onDbUpdate(); 
        fetchUsers(); 
    }, 2000);
  };

  const handleSaveCozeSettings = () => {
    MockDB.saveSettings(settings);
    setCozeSaveStatus('success');
    setTimeout(() => { setCozeSaveStatus(''); onDbUpdate(); }, 2000);
  };

  const handleMigrationClick = () => {
    if (!migrationData || migrationData.length === 0) return;
    if (!settings.supabaseUrl || !settings.supabaseKey) {
        setMigrationResult('error');
        setMigrationStatus("请先保存 Supabase 连接信息！");
        return;
    }
    setShowConfirmDialog(true);
  };

  const confirmMigration = async () => {
    if (!migrationData) return;
    setShowConfirmDialog(false);
    setIsMigrating(true);
    setMigrationResult(null);
    setMigrationStatus("开始连接云数据库...");
    
    try {
        await SupabaseService.uploadData(migrationData, (msg) => setMigrationStatus(msg));
        setMigrationResult('success');
        setMigrationStatus("数据上传成功！已自动切换到云端模式。");
        setMigrationData(null); 
        onDbUpdate(); 
    } catch (e) {
        setMigrationResult('error');
        setMigrationStatus(`上传失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
        setIsMigrating(false);
    }
  };

  const handleUserMigration = async () => {
      if (!settings.supabaseUrl || !settings.supabaseKey) return;
      setIsUserMigrating(true);
      setUserMigrationMsg('正在迁移...');
      try {
          const localUsers = MockDB.getUsers();
          await SupabaseService.migrateUsers(localUsers);
          setUserMigrationMsg(`成功迁移 ${localUsers.length} 个用户`);
          fetchUsers(); 
      } catch (e) {
          setUserMigrationMsg('迁移失败');
          console.error(e);
      } finally {
          setTimeout(() => setUserMigrationMsg(''), 3000);
          setIsUserMigrating(false);
      }
  };

  const SUPABASE_SQL = `
-- 1. 创建视频表
create table if not exists videos (
  id text primary key,
  title text,
  file_name text,
  upload_date text,
  public_url text
);

-- 2. 创建字幕表
create table if not exists transcripts (
  id bigint generated by default as identity primary key,
  video_id text references videos(id),
  start_time text,
  end_time text,
  text text,
  seconds numeric
);

-- 3. 创建用户表 (Simple Auth)
create table if not exists app_users (
  id text primary key,
  username text unique,
  password text,
  role text,
  status text,
  note text
);

-- 4. 开启全文检索 (加速搜索)
alter table transcripts add column if not exists fts tsvector generated always as (to_tsvector('simple', text)) stored;
create index if not exists transcripts_fts on transcripts using GIN (fts);

-- 5. 配置访问权限 (重要：允许读写)
alter table videos enable row level security;
alter table transcripts enable row level security;
alter table app_users enable row level security;

create policy "Enable access for all users" on videos for all using (true) with check (true);
create policy "Enable access for all users" on transcripts for all using (true) with check (true);
create policy "Enable access for all users" on app_users for all using (true) with check (true);
  `.trim();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
         onClick={(e) => {
           if (e.target === e.currentTarget) {
             if (!isMigrating && !isUserMigrating) {
                onClose();
             }
           }
         }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400"><Shield className="w-5 h-5" /></span>
            管理后台
          </h2>
          <button onClick={() => { if(!isMigrating && !isUserMigrating) onClose(); }} 
            className={`transition ${isMigrating || isUserMigrating ? 'opacity-30 cursor-not-allowed text-slate-500' : 'text-slate-400 hover:text-white'}`}>
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-slate-700 bg-slate-900/50 overflow-x-auto no-scrollbar">
          {['users', 'data', 'coze'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 text-sm font-medium transition capitalize whitespace-nowrap ${activeTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}>
                {tab === 'users' ? '用户管理' : tab === 'data' ? '数据库配置' : 'Coze AI'}
              </button>
          ))}
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
          {activeTab === 'users' && (
            <div>
                {settings.supabaseUrl && settings.supabaseKey && (
                    <div className="mb-4 bg-indigo-900/20 border border-indigo-500/30 p-3 rounded flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                            <Cloud className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs text-indigo-200">当前显示：Supabase 云端用户数据</span>
                        </div>
                        <button onClick={handleUserMigration} disabled={isUserMigrating} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-white flex gap-1">
                            {isUserMigrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                            {userMigrationMsg || "一键迁移本地用户到云端"}
                        </button>
                    </div>
                )}

                <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-700 text-slate-400">
                    <tr><th className="px-4 py-3">用户名</th><th className="px-4 py-3">备注</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th></tr>
                </thead>
                <tbody>
                    {users.map(user => (
                    <tr key={user.id} className="border-b border-slate-700">
                        <td className="px-4 py-3">{user.username} <span className="text-xs opacity-50 ml-1">({user.role})</span></td>
                        <td className="px-4 py-3">
                            <input type="text" defaultValue={user.note || ''} onBlur={(e) => handleNoteBlur(user.id, e.target.value)}
                                placeholder="..." className="bg-transparent focus:border-indigo-500 border-b border-transparent outline-none w-full" />
                        </td>
                        <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {user.status}
                        </span>
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                        {user.role !== 'admin' && (
                            <>
                            <button onClick={() => handleStatusChange(user.id, 'active')} className="text-green-400"><CheckCircle className="w-4 h-4"/></button>
                            <button onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-400"><XCircle className="w-4 h-4"/></button>
                            </>
                        )}
                        </td>
                    </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-slate-500">暂无用户数据</td></tr>}
                </tbody>
                </table>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              {/* Plan A: Remote JSON */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-md font-semibold text-white mb-2 flex gap-2"><Files className="w-5 h-5 text-indigo-400"/> 方案 A: 远程 JSON (轻量级)</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="https://example.com/data.json" className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                    value={settings.remoteDatabaseUrl} onChange={e => setSettings({...settings, remoteDatabaseUrl: e.target.value})} />
                  <button onClick={handleSaveJsonSettings} className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded text-sm whitespace-nowrap min-w-[60px] flex items-center justify-center">
                      {jsonSaveStatus === 'success' ? <span className="text-green-400 flex items-center gap-1"><Check className="w-3 h-3"/> 已保存</span> : '保存'}
                  </button>
                </div>
              </div>

              {/* Plan B: Supabase (Cloud DB) */}
              <div className="bg-slate-800 border border-indigo-500/30 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-bl">推荐方案 (支持海量数据)</div>
                <h3 className="text-md font-semibold text-white mb-4 flex gap-2"><Database className="w-5 h-5 text-indigo-400"/> 方案 B: Supabase 云数据库</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs text-slate-400">Project URL</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                            value={settings.supabaseUrl} onChange={e => setSettings({...settings, supabaseUrl: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">API Key (anon/public)</label>
                        <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                            value={settings.supabaseKey} onChange={e => setSettings({...settings, supabaseKey: e.target.value})} />
                    </div>
                </div>
                <button onClick={handleSaveSupabaseSettings} className={`w-full py-2 rounded text-sm mb-6 transition flex items-center justify-center gap-2 font-medium ${supabaseSaveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                    {supabaseSaveStatus === 'success' ? <><Check className="w-4 h-4"/> 配置已保存</> : '保存云端配置'}
                </button>

                <div className="border-t border-slate-700 pt-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">步骤 1: 数据库初始化 (运行 SQL)</h4>
                    <div className="relative group">
                        <pre className="bg-black p-3 rounded text-[10px] text-slate-400 font-mono h-24 overflow-y-auto border border-slate-700">{SUPABASE_SQL}</pre>
                        <button onClick={() => navigator.clipboard.writeText(SUPABASE_SQL)} className="absolute top-2 right-2 p-1 bg-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition">复制 SQL</button>
                    </div>
                </div>

                <div className="border-t border-slate-700 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">步骤 2: 数据生成与迁移</h4>
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                        <BatchJsonGenerator onDataReady={(data) => setMigrationData(data)} />
                        
                        {migrationData && (
                            <div className="mt-4 flex flex-col gap-3 bg-indigo-900/20 p-3 rounded border border-indigo-500/30">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs">
                                        <p className="text-indigo-300 font-bold">准备就绪</p>
                                        <p className="text-slate-400">已解析 {migrationData.length} 个视频，可以直接上传到云端。</p>
                                    </div>
                                    {!showConfirmDialog ? (
                                        <button 
                                            onClick={handleMigrationClick}
                                            disabled={isMigrating}
                                            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 ${isMigrating ? 'bg-slate-700' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                        >
                                            {isMigrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                                            {isMigrating ? '正在上传...' : '开始上传到 Supabase'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <span className="text-xs text-yellow-500 font-medium mr-2">确定上传吗？(耗时操作)</span>
                                            <button onClick={confirmMigration} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-500">确定</button>
                                            <button onClick={() => setShowConfirmDialog(false)} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600">取消</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {(migrationResult || migrationStatus) && !migrationData && (
                            <div className={`mt-4 p-3 rounded border flex items-center gap-3 ${migrationResult === 'error' ? 'bg-red-900/20 border-red-500/30 text-red-300' : 'bg-green-900/20 border-green-500/30 text-green-300'}`}>
                                {migrationResult === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
                                <span className="text-xs">{migrationStatus}</span>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coze' && (
            <div className="space-y-4">
               <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                 <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2"><Bot className="w-5 h-5 text-indigo-400" /> API 配置</h3>
                 <div className="space-y-3">
                    <input type="text" placeholder="Bot ID" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                          value={settings.cozeBotId} onChange={e => setSettings({...settings, cozeBotId: e.target.value})} />
                    <input type="password" placeholder="PAT Token" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                          value={settings.cozeApiKey} onChange={e => setSettings({...settings, cozeApiKey: e.target.value})} />
                    <button onClick={handleSaveCozeSettings} className={`w-full py-2 rounded text-sm transition font-medium ${cozeSaveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                        {cozeSaveStatus === 'success' ? '已保存' : '保存 Coze 配置'}
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
  const [dbMode, setDbMode] = useState<'local' | 'supabase'>('local');
  
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MockDB.init();
    initData();
  }, []);
  
  useEffect(() => {
    const timer = setTimeout(() => { handleSearch(); }, isAiSearch ? 1000 : 500);
    return () => clearTimeout(timer);
  }, [searchQuery, isAiSearch]);

  useEffect(() => {
    if (activeSegmentIndex !== -1 && transcriptRef.current) {
        setTimeout(() => {
            const child = transcriptRef.current?.children[activeSegmentIndex] as HTMLElement;
            if (child) {
                child.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setIsTranscriptLoading(false), 800);
            } else {
                setIsTranscriptLoading(false);
            }
        }, 100);
    }
  }, [activeSegmentIndex]);

  const initData = async () => {
    const settings = MockDB.getSettings();
    
    if (settings.supabaseUrl && settings.supabaseKey) {
        console.log("Initializing in Supabase Mode");
        setDbMode('supabase');
        const cloudVideos = await SupabaseService.getAllVideos();
        setVideos(cloudVideos); 
    } else {
        console.log("Initializing in Local/Remote Mode");
        setDbMode('local');
        
        let allVideos: VideoData[] = [];
        const remoteUrl = settings.remoteDatabaseUrl?.trim();

        if (remoteUrl) {
          try {
            const finalUrl = remoteUrl.includes('github.com') && remoteUrl.includes('/blob/') 
                ? remoteUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
                : remoteUrl;
            const response = await fetch(finalUrl);
            if (response.ok) {
              const remoteData = await response.json();
              if (Array.isArray(remoteData)) allVideos = [...remoteData];
            }
          } catch (e) { console.warn("Remote fetch failed", e); }
        }
        const localVideos = MockDB.getLocalVideos();
        allVideos = [...allVideos, ...localVideos];
        setVideos(allVideos);
    }
  };
  
  const handleSearch = async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      setIsSearching(true);
      const settings = MockDB.getSettings();

      try {
          if (isAiSearch) {
              const results = await cozeSearch(searchQuery, settings, videos);
              setSearchResults(results);
          } 
          else if (dbMode === 'supabase') {
              const results = await SupabaseService.search(searchQuery);
              setSearchResults(results);
          } 
          else {
              const results = fallbackSearch(searchQuery, videos);
              setSearchResults(results);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearching(false);
      }
  };

  const handleLogout = () => {
    MockDB.clearRememberedUser();
    setCurrentUser(null);
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };
  
  const handleImmediateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedVideo) {
           const url = URL.createObjectURL(file);
           setVideos(prev => prev.map(v => v.id === selectedVideo.id ? { ...v, dataUrl: url } : v));
           setSelectedVideo(prev => prev ? { ...prev, dataUrl: url } : null);
      }
  };
  
  const handleSearchResultClick = async (result: SearchResult) => {
      setIsTranscriptLoading(true);
      let targetVideo = result.video;

      const cachedVideo = videos.find(v => v.id === targetVideo.id);
      
      if (cachedVideo) {
          if (cachedVideo.dataUrl) {
              targetVideo.dataUrl = cachedVideo.dataUrl;
          }
          if ((!targetVideo.transcript || targetVideo.transcript.length === 0) && cachedVideo.transcript && cachedVideo.transcript.length > 0) {
              targetVideo.transcript = cachedVideo.transcript;
          }
      }

      if (selectedVideo && selectedVideo.id === targetVideo.id && selectedVideo.dataUrl && !targetVideo.dataUrl) {
           targetVideo.dataUrl = selectedVideo.dataUrl;
      }

      if (dbMode === 'supabase' && (!targetVideo.transcript || targetVideo.transcript.length === 0)) {
           const fullTranscript = await SupabaseService.fetchTranscript(targetVideo.id);
           targetVideo.transcript = fullTranscript;
           setVideos(prev => prev.map(v => v.id === targetVideo.id ? { ...v, transcript: fullTranscript } : v));
      }

      setSelectedVideo({ ...targetVideo });
      
      let index = -1;
      if (targetVideo.transcript && targetVideo.transcript.length > 0) {
          index = targetVideo.transcript.findIndex(t => t.startTime === result.segment.startTime);
          if (index === -1) {
              index = targetVideo.transcript.findIndex(t => Math.abs(t.seconds - result.segment.seconds) < 1.0);
          }
      }

      if (index !== -1) setActiveSegmentIndex(index);
      
      setTimeout(() => handleSeek(result.segment.seconds), 100);
  };

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 flex-shrink-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg"><Database className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">视频智搜</h1>
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                 {dbMode === 'supabase' ? <span className="text-green-400 flex items-center gap-1"><Cloud className="w-3 h-3"/> 云端数据库</span> : '本地/远程文件模式'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 mr-2">
                 <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                     {currentUser.username.substring(0,2).toUpperCase()}
                 </div>
                 <span className="text-sm text-slate-300 font-medium hidden md:block">{currentUser.username}</span>
             </div>
             {currentUser.role === 'admin' && (
              <button onClick={() => setShowAdmin(true)} className="p-2 hover:bg-slate-800 rounded-full text-indigo-400 hover:text-indigo-300 transition" title="设置">
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition" title="退出登录">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-hidden">
        {/* LAYOUT CHANGED: 1:1 RATIO (lg:grid-cols-2) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* 左侧搜索栏 - 在所有设备上可见，移动端自动占据全宽全高 */}
          <div className="flex flex-col h-full min-h-0 gap-4">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex-shrink-0">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">内容搜索</h2>
                  <button onClick={() => setIsAiSearch(!isAiSearch)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${isAiSearch ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    <Sparkles className="w-3 h-3" /> {isAiSearch ? 'AI 模式' : '关键词'}
                  </button>
              </div>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{isSearching ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}</span>
                    <input type="text" placeholder={isAiSearch ? "输入问题..." : "搜索关键词..."} 
                        className="w-full bg-slate-900 border border-slate-700 pl-10 pr-8 py-3 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button 
                    onClick={() => handleSearch()} 
                    disabled={isSearching}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 rounded-lg font-medium transition flex items-center justify-center h-full">
                    搜索
                </button>
              </div>
              
              <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                  <span className="text-indigo-400 font-bold flex-shrink-0 flex items-center gap-1"><Info className="w-3 h-3"/> 小提示：</span>
                  <span>
                    您可以输入多个关键词，中间用空格分割，比如：
                    <span className="text-indigo-200 font-bold bg-indigo-500/20 px-1 py-0.5 rounded mx-1">未来十年 确定性 普通人 机会</span>
                  </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
              {searchResults.length === 0 && !searchQuery && (
                  <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                      <Search className="w-10 h-10 opacity-20 mb-2"/>
                      <p className="text-sm">请输入关键词开始搜索</p>
                  </div>
              )}
              {searchResults.map((result, idx) => (
                <div key={idx} onClick={() => handleSearchResultClick(result)}
                  className={`border p-4 rounded-lg cursor-pointer transition relative overflow-hidden flex-shrink-0 flex flex-col gap-2 ${result.isAiMatch ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'}`}>
                  
                  {/* Result Header: Title and Time */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <FileVideo className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-300 whitespace-normal break-all">{result.video.title}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-black/20 px-1.5 py-0.5 rounded flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{result.segment.startTime}</span>
                        {result.segment.endTime && <span>- {result.segment.endTime}</span>}
                    </div>
                  </div>

                  {/* Result Body: Content Context */}
                  <div className="text-sm leading-relaxed mt-2">
                    {result.isAiMatch && result.aiQuote ? (
                      <div className="text-white font-medium italic bg-indigo-500/10 p-2 rounded border-l-2 border-indigo-500">
                         "{result.aiQuote}"
                      </div>
                    ) : (
                      <div className="text-slate-400">
                          {/* Inline context presentation */}
                          {result.context?.prev && <span>{result.context.prev} </span>}
                          <span className={`text-slate-100 font-medium ${isAiSearch ? 'bg-indigo-500/20 text-indigo-100' : 'bg-yellow-500/10 text-yellow-100'} px-1 rounded`}>
                              {result.segment.text}
                          </span>
                          {result.context?.next && <span> {result.context.next}</span>}
                      </div>
                    )}
                  </div>
                  
                  {/* Result Footer: AI Reasoning */}
                  {result.isAiMatch && result.aiReasoning && (
                    <div className="mt-1 text-xs text-indigo-300/80 flex items-start gap-1 pt-2 border-t border-slate-700/30">
                       <Bot className="w-3 h-3 mt-0.5 flex-shrink-0" /> 
                       <span>{result.aiReasoning}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧播放/字幕区域 - 在移动端隐藏 (hidden lg:flex) */}
          {/* COL-SPAN CHANGED: lg:col-span-1 (was 2) */}
          <div className="hidden lg:flex lg:col-span-1 h-full min-h-0 flex-col">
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-full">
                <div className="bg-black relative flex items-center justify-center border-b border-slate-800 flex-shrink-0 h-[40%] min-h-[200px]">
                  {selectedVideo && (selectedVideo.publicUrl || selectedVideo.dataUrl) ? (
                    <video ref={videoRef} src={selectedVideo.publicUrl || selectedVideo.dataUrl} controls className="w-full h-full object-contain" />
                  ) : selectedVideo ? (
                    <div className="text-center p-8 max-w-md">
                      <div className="bg-slate-800 p-4 rounded-full inline-block mb-4"><HardDrive className="w-8 h-8 text-indigo-400" /></div>
                      <h3 className="text-xl font-bold text-white mb-2">需要本地文件</h3>
                      <p className="text-slate-400 text-sm mb-6">请选择文件 <strong> {selectedVideo.fileName}</strong> 进行播放。</p>
                      <div className="flex flex-col items-center gap-2">
                         <input type="file" accept="video/*" onChange={handleImmediateFileSelect} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-900 rounded-full border border-slate-700 max-w-[250px]" />
                         <p className="text-[10px] text-indigo-400/80 mt-2 bg-slate-800/50 p-2 rounded border border-indigo-500/10">提示：上传对应视频后点击搜索结果或者下方文案即可跳转。</p>
                      </div>
                    </div>
                  ) : (
                      <div className="text-slate-600 flex flex-col items-center"><Play className="w-12 h-12 opacity-20 mb-2" /><span className="text-sm opacity-40">请点击左侧结果播放</span></div>
                  )}
                </div>
                
                <div className="bg-slate-800 flex-1 flex flex-col min-h-0 relative">
                  <div className="px-4 py-3 border-b border-slate-700/50 flex-shrink-0 bg-slate-800 z-10">
                    {selectedVideo ? (
                        <>
                            <h2 className="text-lg font-bold text-white truncate">{selectedVideo.title}</h2>
                            <div className="text-xs text-slate-500 mt-1">ID: {selectedVideo.id.split('_')[1] || '...'}</div>
                        </>
                    ) : <div className="h-6 w-1/3 bg-slate-700/50 rounded animate-pulse"></div>}
                  </div>

                  <div className="px-4 py-2 bg-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700/30 flex-shrink-0 backdrop-blur-sm z-10 sticky top-0">
                     <Files className="w-3 h-3" /> 全文记录
                  </div>
                  
                  {isTranscriptLoading && (
                    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="flex flex-col items-center gap-2 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xl">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            <span className="text-sm text-indigo-300 font-medium">正在定位...</span>
                        </div>
                    </div>
                  )}

                  <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar scroll-smooth">
                    {selectedVideo?.transcript?.map((t, i) => (
                      <div key={i} onClick={() => { setActiveSegmentIndex(i); if (selectedVideo.dataUrl || selectedVideo.publicUrl) handleSeek(t.seconds); }}
                        className={`flex gap-4 p-2.5 rounded cursor-pointer group text-sm transition-colors border-l-2 ${activeSegmentIndex === i ? 'bg-indigo-600/20 border-indigo-500' : 'border-transparent hover:bg-slate-700/50'}`}>
                        <span className={`font-mono min-w-[50px] text-xs pt-0.5 ${activeSegmentIndex === i ? 'text-indigo-300 font-bold' : 'text-slate-600'}`}>{t.startTime}</span>
                        <p className={`leading-relaxed ${activeSegmentIndex === i ? 'text-white' : 'text-slate-400'}`}>{t.text}</p>
                      </div>
                    )) || <div className="text-center text-slate-600 text-sm mt-10">暂无内容</div>}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </main>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} onDbUpdate={initData} />}
    </div>
  );
};

export default App;

const container = document.getElementById('app');
if (container) { createRoot(container).render(<App />); }