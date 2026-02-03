import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Music, X, Edit3, Volume2, Trash2, Plus, ArrowLeft, Image as ImageIcon, MoreVertical, Repeat, Check, MoveHorizontal, Settings2, ChevronUp, User as UserIcon, Share2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { AuthView, supabase } from './auth/AuthView';
import { ProfileView } from './auth/ProfileView';
import { InteractiveTour, TourStep } from './InteractiveTour';
import { SoundUploadModal } from './SoundUploadModal';
import { LocalModeIndicator } from './LocalModeIndicator';
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { initServer, loadProjects, saveProjects, uploadFile, getSignedUrl, getSharedProject, getUserPreferences, saveUserPreferences } from '../utils/api';
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from "./ui/drawer";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };

export type AudioSettings = {
  volume: number; // 0 to 1
  pan: number;    // -1 (left) to 1 (right)
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
};

export type Hotspot = {
  id: string;
  points: Point[];
  audioFile: File | null;
  audioUrl: string | null;
  audioPath?: string | null;
  name: string;
  color: string;
  settings: AudioSettings;
};

export type GlobalChannel = {
  id: string;
  name: string;
  audioFile: File | null;
  audioUrl: string | null;
  audioPath?: string | null;
  settings: AudioSettings;
};

export type Project = {
  id: string;
  title: string;
  imageFile: File | null;
  imageUrl: string | null;
  imagePath?: string | null;
  hotspots: Hotspot[];
  globalChannels: GlobalChannel[];
  introAudioFile: File | null;
  introAudioUrl: string | null;
  introAudioPath?: string | null;
  introAudioLoop: boolean;
  createdAt: number;
};

type ViewMode = 'gallery' | 'editor' | 'player' | 'profile';

const COLORS = [
  "#4f46e5", // Indigo
  "#0ea5e9", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#64748b", // Slate
];

// ---------------------------------------------------------------------------
// CUSTOM UI COMPONENTS
// ---------------------------------------------------------------------------

const VolumeSlider = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => (
  <div className="space-y-3">
    <div className="flex justify-between text-xs text-slate-500 font-medium">
      <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /> Volume</span>
      <span>{Math.round(value * 100)}%</span>
    </div>
    <Slider 
      value={[value]} 
      max={1} step={0.01} 
      onValueChange={([v]) => onChange(v)}
      className="[&_.bg-primary]:bg-slate-700"
    />
  </div>
);

const PanSlider = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => (
  <div className="space-y-3">
    <div className="flex justify-between text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1.5"><MoveHorizontal className="w-3.5 h-3.5" /> Panning</span>
        <span className="font-mono">
            {value === 0 ? "CENTER" : value < 0 ? `L ${Math.abs(Math.round(value * 100))}%` : `R ${Math.round(value * 100)}%`}
        </span>
    </div>
    <div className="relative h-6 flex items-center">
        {/* Center Marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 -translate-x-1/2 z-0" />
        <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full z-0" />
        
        <Slider 
            value={[value]} 
            min={-1} max={1} step={0.05} 
            onValueChange={([v]) => onChange(v)}
            className="relative z-10 [&_.bg-primary]:bg-transparent [&_.bg-primary]:border-transparent [&_.border-primary]:border-slate-600 [&_.border-primary]:bg-white [&_.border-primary]:border-2" 
        />
    </div>
    <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
        <span>L</span>
        <span>R</span>
    </div>
  </div>
);

const FadeSlider = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => (
  <div className="space-y-3">
    <div className="flex justify-between text-xs text-slate-500 font-medium">
      <span className="flex items-center gap-1.5">{label}</span>
      <span>{value.toFixed(1)}s</span>
    </div>
    <Slider 
      value={[value]} 
      max={5} step={0.1} 
      onValueChange={([v]) => onChange(v)}
      className="[&_.bg-primary]:bg-slate-700"
    />
  </div>
);

const ColorPicker = ({ value, onChange }: { value: string, onChange: (color: string) => void }) => (
    <div className="space-y-3">
        <Label className="text-xs text-slate-500 font-medium">Zone Color</Label>
        <div className="flex flex-wrap gap-2">
            {COLORS.map(color => (
                <button
                    key={color}
                    onClick={() => onChange(color)}
                    className={`w-6 h-6 rounded-full transition-all ${value === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// AUDIO ENGINE HOOK
// ---------------------------------------------------------------------------

const useAudioEngine = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Map<string, { source: MediaElementAudioSourceNode, gain: GainNode, panner: StereoPannerNode, audio: HTMLAudioElement, fadeOutTimer?: NodeJS.Timeout, fadeOutDuration: number }>>(new Map());

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      sourcesRef.current.forEach(({ audio }) => audio.pause());
      sourcesRef.current.clear();
    };
  }, []);

  const getContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const play = (id: string, url: string, settings: AudioSettings) => {
    const ctx = getContext();
    const fadeDuration = settings.fadeIn ?? 0.3;
    
    const existing = sourcesRef.current.get(id);
    if (existing) {
        // Update fade out duration
        existing.fadeOutDuration = settings.fadeOut ?? 0.3;

        if (existing.fadeOutTimer) {
            clearTimeout(existing.fadeOutTimer);
            existing.fadeOutTimer = undefined;
            existing.gain.gain.cancelScheduledValues(ctx.currentTime);
            existing.gain.gain.linearRampToValueAtTime(settings.volume, ctx.currentTime + fadeDuration);
            return;
        }
        return; 
    }

    const audio = new Audio(url);
    audio.loop = settings.loop;
    audio.crossOrigin = "anonymous";

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = settings.pan;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(settings.volume, ctx.currentTime + fadeDuration);

    audio.play().catch(e => console.error("Playback failed:", e));
    sourcesRef.current.set(id, { source, gain, panner, audio, fadeOutDuration: settings.fadeOut ?? 0.3 });

    audio.onended = () => {
      if (!settings.loop) {
        sourcesRef.current.delete(id);
      }
    };
  };

  const stop = (id: string) => {
    const node = sourcesRef.current.get(id);
    if (node && !node.fadeOutTimer) {
      const ctx = getContext();
      // Use the stored fadeOutDuration for this specific sound
      const duration = node.fadeOutDuration || 0.3;
      
      node.gain.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.gain.setValueAtTime(node.gain.gain.value, ctx.currentTime);
      node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      const timer = setTimeout(() => {
          node.audio.pause();
          try {
            node.source.disconnect();
            node.gain.disconnect();
            node.panner.disconnect();
          } catch (e) {}
          sourcesRef.current.delete(id);
      }, duration * 1000 + 100); // Add buffer

      node.fadeOutTimer = timer;
    }
  };

  const stopAll = () => {
      sourcesRef.current.forEach((_, id) => {
          const node = sourcesRef.current.get(id);
          if (node && !node.fadeOutTimer) {
            const ctx = getContext();
            // Fast fade out for stopAll
            node.gain.gain.cancelScheduledValues(ctx.currentTime);
            node.gain.gain.setValueAtTime(node.gain.gain.value, ctx.currentTime);
            node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

            setTimeout(() => {
                node.audio.pause();
                try {
                    node.source.disconnect();
                    node.gain.disconnect();
                    node.panner.disconnect();
                } catch (e) {}
                sourcesRef.current.delete(id);
            }, 150);
          }
      });
  };

  const updateSettings = (id: string, settings: AudioSettings) => {
    const node = sourcesRef.current.get(id);
    if (node) {
      // Update the stored fade out duration
      node.fadeOutDuration = settings.fadeOut ?? 0.3;

      if (!node.fadeOutTimer) {
        const ctx = getContext();
        node.gain.gain.cancelScheduledValues(ctx.currentTime);
        node.gain.gain.linearRampToValueAtTime(settings.volume, ctx.currentTime + 0.1);
        
        node.panner.pan.value = settings.pan;
        node.audio.loop = settings.loop;
      }
    }
  };

  return { play, stop, stopAll, updateSettings };
};

// ---------------------------------------------------------------------------
// SETTINGS PANEL CONTENT (REUSABLE)
// ---------------------------------------------------------------------------

const ShareDialogContent = ({ session, project }: { session: any, project: Project }) => {
    const [link, setLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        import('../utils/api').then(({ createShareLink }) => {
            createShareLink(session?.user?.id, project.id).then((data: any) => {
                setLink(`${window.location.origin}?s=${data.shortId}`);
            })
            .catch(err => console.error("Error creating share link:", err))
            .finally(() => setIsLoading(false));
        });
    }, [session?.user?.id, project.id]);

    if (isLoading || !link) {
        return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="flex items-center space-x-2 mt-4">
             <div className="grid flex-1 gap-2">
                <label htmlFor="link" className="sr-only">Link</label>
                <input 
                    id="link" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    readOnly 
                    value={link} 
                />
            </div>
            <Button type="submit" size="sm" className="px-3" onClick={async () => {
                 try {
                    await navigator.clipboard.writeText(link);
                 } catch (e) {
                    const input = document.getElementById('link') as HTMLInputElement;
                    if (input) {
                        input.select();
                        document.execCommand('copy');
                    }
                 }
            }}>
                <span className="sr-only">Copy</span>
                <Copy className="h-4 w-4" />
            </Button>
             <Button type="button" size="sm" variant="secondary" className="px-3" onClick={() => {
                 window.open(link, '_blank');
            }}>
                <ExternalLink className="h-4 w-4" />
            </Button>
        </div>
    );
};

const SettingsPanelContent = ({ 
    project, 
    selectedHotspotId, 
    onUpdate, 
    setSelectedHotspotId,
    addGlobalChannel,
    session,
    openUploadModal,
    previewingChannelId,
    toggleChannelPreview
}: {
    project: Project;
    selectedHotspotId: string | null;
    onUpdate: (p: Project | ((prev: Project) => Project)) => void;
    setSelectedHotspotId: (id: string | null) => void;
    addGlobalChannel: () => void;
    session: any;
    openUploadModal: (type: 'hotspot' | 'channel', id: string) => void;
    previewingChannelId: string | null;
    toggleChannelPreview: (channel: GlobalChannel) => void;
}) => {
    const selectedHotspot = project.hotspots.find(h => h.id === selectedHotspotId);

    if (selectedHotspot) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg">Zone Settings</h2>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedHotspotId(null)}><X className="w-4 h-4" /></Button>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={selectedHotspot.name} onChange={(e) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, name: e.target.value} : h)}))} />
                    </div>
                    
                    <ColorPicker 
                        value={selectedHotspot.color}
                        onChange={(color) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, color: color} : h)}))}
                    />

                    <div className="space-y-2">
                        <Label>Audio File</Label>
                        <div className="bg-slate-50 border rounded-lg p-3">
                            {selectedHotspot.audioUrl ? (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium truncate flex-1">{selectedHotspot.audioFile?.name || "Audio File"}</span>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, audioFile: null, audioUrl: null, audioPath: null} : h)}))}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => openUploadModal('hotspot', selectedHotspot.id)}
                                >
                                    <Upload className="w-4 h-4 mr-2" /> Upload Audio
                                </Button>
                            )}
                        </div>
                    </div>

                    {selectedHotspot.audioUrl && (
                        <div className="space-y-6 pt-2">
                            <VolumeSlider 
                                value={selectedHotspot.settings.volume} 
                                onChange={(v) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, settings: {...h.settings, volume: v}} : h)}))} 
                            />
                            <PanSlider 
                                value={selectedHotspot.settings.pan} 
                                onChange={(v) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, settings: {...h.settings, pan: v}} : h)}))} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FadeSlider 
                                    label="Fade In"
                                    value={selectedHotspot.settings.fadeIn ?? 0.5} 
                                    onChange={(v) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, settings: {...h.settings, fadeIn: v}} : h)}))} 
                                />
                                <FadeSlider 
                                    label="Fade Out"
                                    value={selectedHotspot.settings.fadeOut ?? 0.5} 
                                    onChange={(v) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, settings: {...h.settings, fadeOut: v}} : h)}))} 
                                />
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Repeat className="w-4 h-4 text-slate-500" />
                                    <Label className="text-xs">Loop Audio</Label>
                                </div>
                                <Switch 
                                    checked={selectedHotspot.settings.loop}
                                    onCheckedChange={(c) => onUpdate(p => ({...p, hotspots: p.hotspots.map(h => h.id === selectedHotspot.id ? {...h, settings: {...h.settings, loop: c}} : h)}))}
                                />
                            </div>
                        </div>
                    )}
                        
                        <div className="pt-6 border-t space-y-3">
                        <Button className="w-full" onClick={() => setSelectedHotspotId(null)}>
                            <Check className="w-4 h-4 mr-2" /> Done
                        </Button>
                        <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { onUpdate(p => ({...p, hotspots: p.hotspots.filter(h => h.id !== selectedHotspot.id)})); setSelectedHotspotId(null); }}>
                            Delete Zone
                        </Button>
                        </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8">
            <div>
                <h2 className="font-bold text-lg mb-4">Project Settings</h2>
                
                <div className="space-y-4 mb-6" id="tour-intro-audio">
                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Start Screen Narration</Label>
                    <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
                        {project.introAudioUrl ? (
                            <div className="flex items-center gap-3 bg-white p-2 rounded border">
                                <Music className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-medium truncate flex-1">{project.introAudioFile?.name || "Narration"}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => onUpdate(p => ({...p, introAudioFile: null, introAudioUrl: null, introAudioPath: null}))}><X className="w-3 h-3" /></Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <label>
                                    <Upload className="w-3 h-3 mr-2" /> Upload Narration
                                    <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const path = `${session.user.id}/${project.id}/intro_${Date.now()}.mp3`;
                                                onUpdate(p => ({ ...p, introAudioFile: file, introAudioUrl: URL.createObjectURL(file), introAudioPath: path }));
                                                try { await uploadFile(session.access_token, file, path); } catch(e) { console.error(e); }
                                            }
                                    }} />
                                </label>
                            </Button>
                        )}
                        
                        {project.introAudioUrl && (
                            <div className="flex items-center justify-between px-1">
                                <Label className="text-xs text-slate-500">Loop Narration</Label>
                                <Switch 
                                    checked={project.introAudioLoop}
                                    onCheckedChange={(c) => onUpdate(p => ({...p, introAudioLoop: c}))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-6" id="tour-add-channel">
                    <div className="flex items-center justify-between mb-4">
                        <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Background Channels</Label>
                        <Button size="sm" variant="outline" onClick={addGlobalChannel}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    </div>
                    
                    <div className="space-y-3">
                        {(project.globalChannels || []).length === 0 && (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-300 transition-colors cursor-pointer" onClick={addGlobalChannel}>
                                <div className="mx-auto w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2 text-slate-400">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-slate-600">Add Background Audio</p>
                                <p className="text-xs text-slate-400 mt-1">Rain, city noise, or ambient music</p>
                            </div>
                        )}
                        {(project.globalChannels || []).map(channel => (
                            <div key={channel.id} className="bg-white border rounded-lg p-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <Input 
                                        className="h-7 text-sm font-medium border-none w-32 focus-visible:ring-0" 
                                        value={channel.name}
                                        onChange={(e) => onUpdate(p => ({
                                            ...p,
                                            globalChannels: p.globalChannels.map(c => c.id === channel.id ? { ...c, name: e.target.value } : c)
                                        }))}
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => onUpdate(p => ({...p, globalChannels: p.globalChannels.filter(c => c.id !== channel.id)}))}><X className="w-3 h-3" /></Button>
                                </div>

                                {!channel.audioUrl ? (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full text-xs"
                                        onClick={() => openUploadModal('channel', channel.id)}
                                    >
                                        <Upload className="w-3 h-3 mr-2" /> Upload Audio
                                    </Button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 shrink-0"
                                                    onClick={() => toggleChannelPreview(channel)}
                                                >
                                                    {previewingChannelId === channel.id ? (
                                                        <Pause className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <Play className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                                <span className="truncate">{channel.audioFile?.name || "Audio Track"}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[10px]">Loop</span>
                                                <Switch 
                                                    className="scale-75 origin-right"
                                                    checked={channel.settings.loop}
                                                    onCheckedChange={(c) => onUpdate(p => ({...p, globalChannels: p.globalChannels.map(ch => ch.id === channel.id ? {...ch, settings: {...ch.settings, loop: c}} : ch)}))}
                                                />
                                            </div>
                                        </div>
                                        <VolumeSlider 
                                            value={channel.settings.volume} 
                                            onChange={(v) => onUpdate(p => ({...p, globalChannels: p.globalChannels.map(ch => ch.id === channel.id ? {...ch, settings: {...ch.settings, volume: v}} : ch)}))} 
                                        />
                                        <PanSlider 
                                            value={channel.settings.pan} 
                                            onChange={(v) => onUpdate(p => ({...p, globalChannels: p.globalChannels.map(ch => ch.id === channel.id ? {...ch, settings: {...ch.settings, pan: v}} : ch)}))} 
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FadeSlider 
                                                label="Fade In"
                                                value={channel.settings.fadeIn ?? 2.0} 
                                                onChange={(v) => onUpdate(p => ({...p, globalChannels: p.globalChannels.map(ch => ch.id === channel.id ? {...ch, settings: {...ch.settings, fadeIn: v}} : ch)}))} 
                                            />
                                            <FadeSlider 
                                                label="Fade Out"
                                                value={channel.settings.fadeOut ?? 2.0} 
                                                onChange={(v) => onUpdate(p => ({...p, globalChannels: p.globalChannels.map(ch => ch.id === channel.id ? {...ch, settings: {...ch.settings, fadeOut: v}} : ch)}))} 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Zone Inventory ({project.hotspots.length})</Label>
                    </div>
                    <div className="bg-slate-50 border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        {project.hotspots.length === 0 ? (
                            <p className="text-xs text-slate-400 p-4 text-center italic">Draw on the image to create zones.</p>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {project.hotspots.map(h => (
                                    <div 
                                        key={h.id}
                                        className="flex items-center gap-3 p-3 hover:bg-white hover:text-indigo-600 cursor-pointer transition-colors text-sm text-slate-700"
                                        onClick={() => setSelectedHotspotId(h.id)}
                                    >
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                                        <span className="flex-1 truncate font-medium">{h.name}</span>
                                        {h.audioUrl && <Volume2 className="w-3 h-3 text-slate-400" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

const refreshProjectUrls = async (project: Project, token: string): Promise<Project> => {
    const p = { ...project };
    
    if (p.imagePath) {
        try {
            const { url } = await getSignedUrl(token, p.imagePath);
            p.imageUrl = url;
        } catch (e) { console.error("Failed to refresh image url", e); }
    }
    
    if (p.introAudioPath) {
        try {
            const { url } = await getSignedUrl(token, p.introAudioPath);
            p.introAudioUrl = url;
        } catch (e) { console.error("Failed to refresh intro url", e); }
    }
    
    p.hotspots = await Promise.all(p.hotspots.map(async h => {
        if (h.audioPath) {
            try {
                const { url } = await getSignedUrl(token, h.audioPath);
                return { ...h, audioUrl: url };
            } catch (e) { return h; }
        }
        return h;
    }));
    
    p.globalChannels = await Promise.all((p.globalChannels || []).map(async c => {
        if (c.audioPath) {
             try {
                const { url } = await getSignedUrl(token, c.audioPath);
                return { ...c, audioUrl: url };
             } catch (e) { return c; }
        }
        return c;
    }));
    
    return p;
};

const TOUR_STEPS: TourStep[] = [
    {
        id: 'create-project',
        targetId: 'tour-create-project',
        title: 'Start a Project',
        description: 'Click here to create your first sound map project.',
        placement: 'right'
    },
    {
        id: 'upload-image',
        targetId: 'tour-upload-image',
        title: 'Upload Map',
        description: 'Upload the base image for your sound map. It could be a floorplan, a map, or any artwork.',
        placement: 'bottom'
    },
    {
        id: 'intro-audio',
        targetId: 'tour-intro-audio',
        title: 'Intro Narration',
        description: 'Add audio that will play on the start screen. This sets the context for your users.',
        placement: 'left'
    },
    {
        id: 'add-channel',
        targetId: 'tour-add-channel',
        title: 'Background Audio',
        description: 'Add global background sounds like ambient noise or music that plays underneath specific zones.',
        placement: 'left'
    },
    {
        id: 'preview',
        targetId: 'tour-preview-btn',
        title: 'Preview',
        description: 'Test your interactive experience before sharing it.',
        placement: 'bottom'
    },
    {
        id: 'share',
        targetId: 'tour-share-btn',
        title: 'Share',
        description: 'Share the link to open on a tablet. Users can explore the image by touch, making it accessible for everyone.',
        placement: 'bottom'
    }
];

// ---------------------------------------------------------------------------
// MAIN APP COMPONENT
// ---------------------------------------------------------------------------

export const SoundMapApp = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewMode>('gallery');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'hotspot' | 'channel', id: string } | null>(null);

  const handleTourNext = () => {
      if (tourStepIndex < TOUR_STEPS.length - 1) {
          setTourStepIndex(prev => prev + 1);
      } else {
          setShowOnboarding(false);
          if (session?.access_token) {
            saveUserPreferences(session.access_token, { hasSeenOnboarding: true }).catch(console.error);
          }
      }
  };

  const handleTourClose = () => {
      setShowOnboarding(false);
      if (session?.access_token) {
        saveUserPreferences(session.access_token, { hasSeenOnboarding: true }).catch(console.error);
      }
  };
  
  // Shared View State
  const [sharedProject, setSharedProject] = useState<Project | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [isSharedView, setIsSharedView] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return !!(params.get('userId') && params.get('projectId')) || !!params.get('s');
      }
      return false;
  });

  useEffect(() => {
      if (isSharedView) {
          const params = new URLSearchParams(window.location.search);
          const shortId = params.get('s');

          if (shortId) {
               import('../utils/api').then(({ resolveShareLink, initServer }) => {
                   initServer();
                   resolveShareLink(shortId).then((data: any) => {
                       const { userId, projectId } = data;
                       return import('../utils/api').then(({ getSharedProject }) => getSharedProject(userId, projectId));
                   })
                   .then(setSharedProject)
                   .catch((err) => {
                       console.error("Error resolving short link:", err);
                       setSharedError("Link invalid or expired.");
                   });
               });
          } else {
              const uid = params.get('userId');
              const pid = params.get('projectId');
              
              if (uid && pid) {
                  initServer();
                  getSharedProject(uid, pid)
                    .then(setSharedProject)
                    .catch((err) => {
                        console.error("Error loading shared project:", err);
                        setSharedError("Project not found or could not be loaded.");
                    });
              }
          }
      }
  }, [isSharedView]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load projects and preferences
  useEffect(() => {
      if (session?.access_token) {
          setIsLoadingProjects(true);
          initServer();
          
          // Load Projects
          loadProjects(session.access_token).then(async (loaded: Project[]) => {
              const hydrated = await Promise.all(loaded.map(p => refreshProjectUrls(p, session.access_token)));
              setProjects(hydrated);
          }).catch(console.error)
            .finally(() => setIsLoadingProjects(false));

          // Load Preferences
          getUserPreferences(session.access_token).then(prefs => {
              if (!prefs.hasSeenOnboarding) {
                  setShowOnboarding(true);
              }
          }).catch(console.error);
      }
  }, [session?.access_token]);

  // Auto-save
  useEffect(() => {
      if (session?.access_token && projects.length > 0) {
          setIsSaving(true);
          const timer = setTimeout(() => {
              saveProjects(session.access_token, projects)
                .then(() => setIsSaving(false))
                .catch(e => {
                    console.error(e);
                    setIsSaving(false);
                });
          }, 2000);
          return () => clearTimeout(timer);
      }
  }, [projects, session?.access_token]);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      title: `Untitled Project ${projects.length + 1}`,
      imageFile: null,
      imageUrl: null,
      hotspots: [],
      globalChannels: [],
      introAudioFile: null,
      introAudioUrl: null,
      introAudioLoop: false,
      createdAt: Date.now(),
    };
    setProjects([...projects, newProject]);
    setCurrentProjectId(newProject.id);
    setView('editor');

    if (showOnboarding && tourStepIndex === 0) {
        setTourStepIndex(1);
    }
  };

  const openUploadModal = (type: 'hotspot' | 'channel', id: string) => {
      setUploadTarget({ type, id });
      setUploadModalOpen(true);
  };

  const handleLocalUpload = async (file: File) => {
      if (!uploadTarget || !session) return;
      
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (!currentProject) return;
      
      if (uploadTarget.type === 'hotspot') {
          const path = `${session.user.id}/${currentProject.id}/hs_${uploadTarget.id}_${Date.now()}.mp3`;
          handleUpdateProject(p => ({
              ...p,
              hotspots: p.hotspots.map(h => 
                  h.id === uploadTarget.id 
                      ? {...h, audioFile: file, audioUrl: URL.createObjectURL(file), audioPath: path, name: file.name.split('.')[0]} 
                      : h
              )
          }));
          try { await uploadFile(session.access_token, file, path); } catch(e) { console.error(e); }
      } else if (uploadTarget.type === 'channel') {
          const path = `${session.user.id}/${currentProject.id}/gc_${uploadTarget.id}_${Date.now()}.mp3`;
          handleUpdateProject(p => ({
              ...p,
              globalChannels: p.globalChannels.map(c => 
                  c.id === uploadTarget.id 
                      ? {...c, audioFile: file, audioUrl: URL.createObjectURL(file), audioPath: path} 
                      : c
              )
          }));
          try { await uploadFile(session.access_token, file, path); } catch(e) { console.error(e); }
      }
  };

  const handleLibrarySelect = async (sound: any) => {
      if (!uploadTarget || !session) return;
      
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (!currentProject) return;
      
      try {
          // Download the sound from Freesound
          const response = await fetch(sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3']);
          const blob = await response.blob();
          const file = new File([blob], `${sound.name}.mp3`, { type: 'audio/mpeg' });
          
          if (uploadTarget.type === 'hotspot') {
              const path = `${session.user.id}/${currentProject.id}/hs_${uploadTarget.id}_${Date.now()}.mp3`;
              const audioUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
              handleUpdateProject(p => ({
                  ...p,
                  hotspots: p.hotspots.map(h => 
                      h.id === uploadTarget.id 
                          ? {...h, audioFile: file, audioUrl: audioUrl, audioPath: path, name: sound.name} 
                          : h
                  )
              }));
              try {
                  await uploadFile(session.access_token, file, path);
              } catch (uploadErr: any) {
                  if (uploadErr.message === 'OFFLINE_MODE') {
                      console.log('📍 Using direct URL in local mode');
                  } else {
                      console.error('Upload failed:', uploadErr);
                  }
              }
          } else if (uploadTarget.type === 'channel') {
              const path = `${session.user.id}/${currentProject.id}/gc_${uploadTarget.id}_${Date.now()}.mp3`;
              const audioUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
              handleUpdateProject(p => ({
                  ...p,
                  globalChannels: p.globalChannels.map(c => 
                      c.id === uploadTarget.id 
                          ? {...c, audioFile: file, audioUrl: audioUrl, audioPath: path, name: sound.name} 
                          : c
                  )
              }));
              try {
                  await uploadFile(session.access_token, file, path);
              } catch (uploadErr: any) {
                  if (uploadErr.message === 'OFFLINE_MODE') {
                      console.log('📍 Using direct URL in local mode');
                  } else {
                      console.error('Upload failed:', uploadErr);
                  }
              }
          }
      } catch(e) {
          console.log('⚠️ Failed to download sound from Freesound (might be CORS issue)');
          const audioUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
          if (uploadTarget.type === 'hotspot') {
              handleUpdateProject(p => ({
                  ...p,
                  hotspots: p.hotspots.map(h => 
                      h.id === uploadTarget.id 
                          ? {...h, audioUrl: audioUrl, name: sound.name} 
                          : h
                  )
              }));
          } else if (uploadTarget.type === 'channel') {
              handleUpdateProject(p => ({
                  ...p,
                  globalChannels: p.globalChannels.map(c => 
                      c.id === uploadTarget.id 
                          ? {...c, audioUrl: audioUrl, name: sound.name} 
                          : c
                  )
              }));
          }
      }
  };

  const handleUpdateProject = (updatedProject: Project | ((prev: Project) => Project)) => {
      setProjects(prev => {
          const nextProjects = prev.map(p => {
              if (p.id === currentProjectId) {
                   const nextP = typeof updatedProject === 'function' ? updatedProject(p) : updatedProject;
                   
                   // Tour Logic
                   if (showOnboarding) {
                       // Step 1: Upload Image
                       if (tourStepIndex === 1 && nextP.imageUrl && !p.imageUrl) {
                            setTourStepIndex(2);
                       }
                       // Step 2: Intro Audio
                       if (tourStepIndex === 2 && nextP.introAudioUrl && !p.introAudioUrl) {
                            setTourStepIndex(3);
                       }
                       // Step 3: Add Channel
                       if (tourStepIndex === 3 && (nextP.globalChannels?.length || 0) > (p.globalChannels?.length || 0)) {
                            setTourStepIndex(4);
                       }
                   }
                   return nextP;
              }
              return p;
          });
          return nextProjects;
      });
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setView('gallery');
    }
  };

  const handleShare = () => {
      if (showOnboarding && tourStepIndex === 5) {
          setTourStepIndex(6); // Finish
          setShowOnboarding(false);
          if (session?.access_token) {
            saveUserPreferences(session.access_token, { hasSeenOnboarding: true }).catch(console.error);
          }
      }
  };

  if (isSharedView) {
      if (sharedError) return (
          <div className="flex flex-col h-screen items-center justify-center text-slate-400 bg-slate-900 gap-4">
              <p>{sharedError}</p>
              <Button variant="outline" onClick={() => window.location.href = window.location.pathname}>Return Home</Button>
          </div>
      );
      if (!sharedProject) return <div className="flex h-screen items-center justify-center text-slate-500 bg-slate-900 text-white">Loading experience...</div>;
      return <PlayerView project={sharedProject} onBack={() => { window.location.href = window.location.pathname; }} isShared={true} />;
  }

  if (!session) {
      return <AuthView onLoginSuccess={() => {}} />;
  }

  if (view === 'profile') {
      return <ProfileView onBack={() => setView('gallery')} onSignOut={() => setSession(null)} onShowOnboarding={() => { setView('gallery'); setShowOnboarding(true); setTourStepIndex(0); }} />;
  }

  return (
      <>
        <LocalModeIndicator />
        <InteractiveTour 
            steps={TOUR_STEPS}
            currentStepIndex={tourStepIndex}
            isOpen={showOnboarding}
            onNext={handleTourNext}
            onClose={handleTourClose}
        />
        {view === 'gallery' && (
             <GalleryView projects={projects} onCreate={handleCreateProject} onSelect={(id) => { setCurrentProjectId(id); setView('editor'); }} onDelete={handleDeleteProject} onProfile={() => setView('profile')} isLoading={isLoadingProjects} />
        )}
        {view === 'player' && currentProject && (
             <PlayerView project={currentProject} onBack={() => setView('editor')} />
        )}
        {view === 'editor' && currentProject && (
             <EditorView 
                project={currentProject} 
                onUpdate={handleUpdateProject} 
                onBack={() => setView('gallery')} 
                onPreview={() => {
                    if (showOnboarding && tourStepIndex === 4) setTourStepIndex(5);
                    setView('player');
                }} 
                session={session}
                onShare={handleShare}
                openUploadModal={openUploadModal}
            />
        )}
        {!currentProject && view !== 'gallery' && <div>Error: Project not found</div>}
        
        <SoundUploadModal
            open={uploadModalOpen}
            onOpenChange={setUploadModalOpen}
            onLocalUpload={handleLocalUpload}
            onLibrarySelect={handleLibrarySelect}
        />
      </>
  );
};

// ---------------------------------------------------------------------------
// GALLERY VIEW
// ---------------------------------------------------------------------------

const GalleryView = ({ projects, onCreate, onSelect, onDelete, onProfile, isLoading }: { projects: Project[], onCreate: () => void, onSelect: (id: string) => void, onDelete: (id: string) => void, onProfile: () => void, isLoading: boolean }) => {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Projects</h1>
            <p className="text-slate-500 mt-1">Select a sound map to edit or create a new one.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onProfile} className="text-slate-500 hover:text-indigo-600 h-12 w-12 sm:h-10 sm:w-10">
                <UserIcon className="w-6 h-6 sm:w-5 sm:h-5" />
            </Button>
            <Button 
                id="tour-create-project"
                onClick={onCreate} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shrink-0 rounded-full h-12 w-12 p-0 sm:rounded-md sm:h-10 sm:w-auto sm:px-4 flex items-center justify-center"
            >
                <Plus className="w-6 h-6 sm:w-5 sm:h-5 sm:mr-2" />
                <span className="hidden sm:inline">New Project</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                 <p>Loading projects...</p>
             </div>
          ) : projects.length > 0 ? (
            projects.map(project => (
            <Card key={project.id} className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden border-slate-200">
              <div className="h-48 bg-slate-100 relative flex items-center justify-center overflow-hidden" onClick={() => onSelect(project.id)}>
                {project.imageUrl ? (
                  <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-slate-300" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div onClick={() => onSelect(project.id)} className="flex-1">
                        <h3 className="font-semibold text-slate-800 truncate">{project.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{project.hotspots.length} zones • {project.globalChannels?.length || 0} channels</p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the project "{project.title}". This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onDelete(project.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4"><Music className="w-8 h-8 text-indigo-500" /></div>
                <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
                <Button onClick={onCreate} variant="outline" className="mt-4">Create Project</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EDITOR VIEW
// ---------------------------------------------------------------------------

const pointsToSvgPath = (points: Point[]) => {
  if (points.length === 0) return "";
  return points.map(p => `${p.x},${p.y}`).join(" ");
};

// Check if two polygons overlap using bounding box and point-in-polygon tests
const polygonsOverlap = (poly1: Point[], poly2: Point[]): boolean => {
  // Helper: Check if a point is inside a polygon using ray casting
  const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if any point of poly1 is inside poly2
  for (const point of poly1) {
    if (isPointInPolygon(point, poly2)) return true;
  }

  // Check if any point of poly2 is inside poly1
  for (const point of poly2) {
    if (isPointInPolygon(point, poly1)) return true;
  }

  // Check for edge intersections
  const doSegmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
    const ccw = (a: Point, b: Point, c: Point) => 
      (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  };

  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const p2 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const p3 = poly2[j];
      const p4 = poly2[(j + 1) % poly2.length];
      if (doSegmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }

  return false;
};

const EditorView = ({ project, onUpdate, onBack, onPreview, session, onShare, openUploadModal }: { project: Project, onUpdate: (p: Project | ((prev: Project) => Project)) => void, onBack: () => void, onPreview: () => void, session: any, onShare?: () => void, openUploadModal: (type: 'hotspot' | 'channel', id: string) => void }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  
  // Drawer state for mobile
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const engine = useAudioEngine();
  
  // Preview channel state
  const [previewingChannelId, setPreviewingChannelId] = useState<string | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Clean up preview timer on unmount
  useEffect(() => {
      return () => {
          if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
          }
      };
  }, []);

  const toggleChannelPreview = (channel: GlobalChannel) => {
      if (!channel.audioUrl) return;
      
      const previewId = `preview-${channel.id}`;
      
      if (previewingChannelId === channel.id) {
          engine.stop(previewId);
          setPreviewingChannelId(null);
          if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
          }
      } else {
          // Stop any currently playing preview
          if (previewingChannelId) {
              engine.stop(`preview-${previewingChannelId}`);
          }
          if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
          }
          
          engine.play(previewId, channel.audioUrl, channel.settings);
          setPreviewingChannelId(channel.id);
          
          // Auto-stop after 5 seconds
          previewTimerRef.current = setTimeout(() => {
              engine.stop(previewId);
              setPreviewingChannelId(null);
              previewTimerRef.current = null;
          }, 5000);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const path = `${session.user.id}/${project.id}/bg_${Date.now()}_${file.name}`;
      
      // Optimistic update
      onUpdate(prev => ({ ...prev, imageFile: file, imageUrl: url, hotspots: [], imagePath: path }));
      
      try {
          await uploadFile(session.access_token, file, path);
      } catch (e: any) {
          if (e.message === 'OFFLINE_MODE') {
              console.log('📍 Image stored locally');
          } else {
              console.error("Image upload failed", e);
          }
      }
    }
  };

  const getRelativeCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleStartDrawing = (e: React.MouseEvent) => {
    if (!project.imageUrl) return;
    if ((e.target as Element).tagName === 'polygon') return;
    setIsDrawing(true);
    const point = getRelativeCoordinates(e);
    setCurrentPoints([point]);
    setSelectedHotspotId(null);
    engine.stopAll();
  };

  const handleDrawMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setCurrentPoints(prev => [...prev, getRelativeCoordinates(e)]);
  };

  const handleStopDrawing = () => {
    if (!isDrawing) return;
    if (currentPoints.length > 5) {
        // Check for overlaps with existing hotspots
        const hasOverlap = project.hotspots.some(existingHotspot => {
            return polygonsOverlap(currentPoints, existingHotspot.points);
        });

        if (hasOverlap) {
            // Show error and don't create the zone
            alert('This zone overlaps with an existing zone. Please draw in a different area.');
            setIsDrawing(false);
            setCurrentPoints([]);
            return;
        }

        const newHotspot: Hotspot = {
            id: crypto.randomUUID(),
            points: currentPoints,
            audioFile: null,
            audioUrl: null,
            name: `Zone ${project.hotspots.length + 1}`,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            settings: { volume: 1, pan: 0, loop: false, fadeIn: 0.5, fadeOut: 0.5 }
        };
        onUpdate({ ...project, hotspots: [...project.hotspots, newHotspot] });
        setSelectedHotspotId(newHotspot.id);
        // Auto open drawer on mobile if new hotspot created
        if (window.innerWidth < 1024) setIsDrawerOpen(true);
    }
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const addGlobalChannel = () => {
      const newChannel: GlobalChannel = {
          id: crypto.randomUUID(),
          name: `Channel ${(project.globalChannels || []).length + 1}`,
          audioFile: null,
          audioUrl: null,
          settings: { volume: 0.5, pan: 0, loop: true, fadeIn: 2.0, fadeOut: 2.0 }
      };
      onUpdate({ ...project, globalChannels: [...(project.globalChannels || []), newChannel] });
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-20 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
            <Input 
                className="font-semibold text-lg border-transparent hover:border-slate-200 focus-visible:border-indigo-500 shadow-none focus-visible:ring-0 px-3 h-9 flex-1 min-w-0 max-w-md transition-colors" 
                value={project.title}
                onChange={(e) => onUpdate({...project, title: e.target.value})}
            />
        </div>
        <div className="flex items-center gap-3">
            <Dialog>
                <DialogTrigger asChild>
                     <Button variant="outline" size="sm" className="hidden sm:flex" id="tour-share-btn" onClick={onShare}>
                        <Share2 className="w-4 h-4 mr-2" /> Share
                     </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Share Project</DialogTitle>
                        <DialogDescription>Anyone with this link can view and play your sound map. Perfect for tablets.</DialogDescription>
                    </DialogHeader>
                    <ShareDialogContent session={session} project={project} />
                </DialogContent>
            </Dialog>

            <Button id="tour-preview-btn" onClick={onPreview} className="bg-indigo-600 text-white shrink-0 h-9 w-9 sm:w-auto sm:px-4 p-0 flex items-center justify-center" disabled={!project.imageUrl}>
                <Play className="w-4 h-4 sm:mr-2" /> 
                <span className="hidden sm:inline">Preview</span>
            </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
        {/* Canvas Area - Takes full height on mobile */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-4 lg:p-8 select-none h-full">
            {!project.imageUrl ? (
                 <div className="text-center" id="tour-upload-image">
                    <Button asChild size="lg">
                        <label className="cursor-pointer">
                            <Upload className="w-5 h-5 mr-2" /> Upload Image
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                    </Button>
                 </div>
            ) : (
                <div 
                    ref={imageContainerRef}
                    className="relative shadow-2xl"
                    onMouseDown={handleStartDrawing}
                    onMouseMove={handleDrawMove}
                    onMouseUp={handleStopDrawing}
                    onMouseLeave={handleStopDrawing}
                >
                    <img src={project.imageUrl} className="max-w-full max-h-[85vh] block pointer-events-none select-none" draggable={false} />
                    <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {project.hotspots.map((h) => (
                            <polygon
                                key={h.id}
                                points={pointsToSvgPath(h.points)}
                                fill={selectedHotspotId === h.id ? h.color : h.color}
                                fillOpacity={selectedHotspotId === h.id ? 0.5 : 0.25}
                                stroke={selectedHotspotId === h.id ? "white" : h.color}
                                strokeWidth={selectedHotspotId === h.id ? "0.8" : "0.4"}
                                style={{ pointerEvents: 'all', cursor: 'pointer', vectorEffect: 'non-scaling-stroke' }}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedHotspotId(h.id); 
                                    if (h.audioUrl) {
                                        engine.stopAll();
                                        engine.play(h.id, h.audioUrl, h.settings);
                                    }
                                    if (window.innerWidth < 1024) setIsDrawerOpen(true);
                                }}
                            />
                        ))}
                        {isDrawing && currentPoints.length > 0 && (
                            <polygon points={pointsToSvgPath(currentPoints)} fill="rgba(99, 102, 241, 0.2)" stroke="#4f46e5" strokeWidth="0.5" />
                        )}
                    </svg>
                </div>
            )}
        </div>

        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden lg:flex w-96 bg-white border-l shadow-xl z-10 flex-col shrink-0">
            <div className="flex-1 overflow-y-auto">
                <SettingsPanelContent 
                    project={project}
                    selectedHotspotId={selectedHotspotId}
                    onUpdate={onUpdate}
                    setSelectedHotspotId={setSelectedHotspotId}
                    addGlobalChannel={addGlobalChannel}
                    session={session}
                    openUploadModal={openUploadModal}
                    previewingChannelId={previewingChannelId}
                    toggleChannelPreview={toggleChannelPreview}
                />
            </div>
        </div>

        {/* Mobile Bottom Bar Trigger & Drawer */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 pointer-events-none flex justify-center z-30">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                    <Button className="shadow-xl rounded-full pointer-events-auto bg-white text-indigo-600 hover:bg-slate-50 border border-slate-200 h-12 px-6">
                        <Settings2 className="w-5 h-5 mr-2" />
                        {selectedHotspotId ? "Edit Zone" : "Settings & Layers"}
                        <ChevronUp className="w-4 h-4 ml-2 opacity-50" />
                    </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85vh] flex flex-col">
                    <DrawerTitle className="sr-only">Project Settings</DrawerTitle>
                    <DrawerDescription className="sr-only">Manage zones, audio, and project settings.</DrawerDescription>
                    <div className="overflow-y-auto flex-1">
                         <SettingsPanelContent 
                            project={project}
                            selectedHotspotId={selectedHotspotId}
                            onUpdate={onUpdate}
                            setSelectedHotspotId={(id) => {
                                setSelectedHotspotId(id);
                                // If creating/selecting, we might want to keep drawer open or logic depends on user flow.
                                // For now, keep open.
                            }}
                            addGlobalChannel={addGlobalChannel}
                            session={session}
                            openUploadModal={openUploadModal}
                            previewingChannelId={previewingChannelId}
                            toggleChannelPreview={toggleChannelPreview}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PLAYER VIEW
// ---------------------------------------------------------------------------

const PlayerView = ({ project, onBack, isShared }: { project: Project, onBack: () => void, isShared?: boolean }) => {
    const [hasStarted, setHasStarted] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const engine = useAudioEngine();
    const introAudioRef = useRef<HTMLAudioElement | null>(null);

    const handleStart = () => {
        setHasStarted(true);

        // Request Fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch((err) => console.log("Fullscreen blocked", err));
        }

        if (introAudioRef.current) {
            introAudioRef.current.pause();
        }
        engine.stopAll(); 
        
        (project.globalChannels || []).forEach(channel => {
            if (channel.audioUrl) {
                engine.play(channel.id, channel.audioUrl, channel.settings);
            }
        });
    };

    // Auto-play intro on mount
    useEffect(() => {
        if (!hasStarted && project.introAudioUrl) {
            const audio = new Audio(project.introAudioUrl);
            audio.loop = project.introAudioLoop; // Use loop setting
            introAudioRef.current = audio;
            audio.play().catch(e => console.log("Autoplay blocked by browser policy:", e));
            return () => {
                audio.pause();
            };
        }
    }, [hasStarted, project.introAudioUrl, project.introAudioLoop]);

    const playHotspot = (hotspot: Hotspot) => {
        if (!hotspot.audioUrl) return;
        if (playingId === hotspot.id) return;
        // If we switch directly from one hotspot to another, 
        // we might want to fade the old one out quickly while starting the new one
        // The engine handles fading out if we stop it.
        if (playingId) engine.stop(playingId);
        engine.play(hotspot.id, hotspot.audioUrl, hotspot.settings);
        setPlayingId(hotspot.id);
    };

    const stopHotspot = (hotspot: Hotspot) => {
        if (playingId === hotspot.id && !hotspot.settings.loop) {
             engine.stop(playingId);
             setPlayingId(null);
        }
        // If it IS looping, we also stop it on mouse leave (fade out)
        // Usually in these maps, "hover" = play, "leave" = stop, even if looping.
        // Looping just means it repeats WHILE you hover.
        else if (playingId === hotspot.id && hotspot.settings.loop) {
             engine.stop(playingId);
             setPlayingId(null);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.tagName === 'polygon') {
            const id = element.getAttribute('data-id');
            if (id && id !== playingId) {
                const hotspot = project.hotspots.find(h => h.id === id);
                if (hotspot) playHotspot(hotspot);
            }
        } else if (playingId) {
            // If we touched outside any polygon, stop playing
             engine.stop(playingId);
             setPlayingId(null);
        }
    };

    if (!hasStarted) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center z-[100]">
                <div className="max-w-md w-full animate-in fade-in zoom-in duration-300 space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">{project.title}</h1>
                        <p className="text-slate-400">Interactive Sound Map</p>
                    </div>
                    <Button size="lg" onClick={handleStart} className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl rounded-full transition-all hover:scale-105">
                        <Play className="w-6 h-6 mr-2 fill-current" />
                        Start Experience
                    </Button>
                    <Button variant="link" className="text-slate-500" onClick={onBack}>
                        {isShared ? "Create Your Own" : (
                            <><ArrowLeft className="w-4 h-4 mr-2" /> Back to Editor</>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
            <div className="absolute top-4 left-4 z-50">
                {!isShared ? (
                    <Button variant="secondary" size="sm" onClick={onBack} className="bg-black/20 text-white border-none backdrop-blur-md hover:bg-black/40">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Edit
                    </Button>
                ) : (
                    <Button variant="secondary" size="sm" className="bg-black/20 text-white border-none backdrop-blur-md" onClick={() => {
                         window.location.href = window.location.pathname;
                    }}>
                        <Plus className="w-4 h-4 mr-2" /> Create Map
                    </Button>
                )}
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onTouchMove={handleTouchMove}>
                <div className="relative shadow-2xl select-none" style={{ touchAction: 'none' }}>
                    <img src={project.imageUrl || ""} className="max-w-full max-h-[90vh] block pointer-events-none" draggable={false} />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                         {project.hotspots.map((h) => (
                            <polygon
                                key={h.id}
                                data-id={h.id}
                                points={pointsToSvgPath(h.points)}
                                fill={playingId === h.id ? h.color : "transparent"}
                                fillOpacity={0.5}
                                stroke="transparent"
                                onMouseEnter={() => playHotspot(h)}
                                onMouseLeave={() => stopHotspot(h)}
                                onTouchStart={() => playHotspot(h)}
                                className="cursor-crosshair transition-all duration-200"
                            />
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
};
