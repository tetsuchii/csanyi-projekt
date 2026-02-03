import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, Play, Pause, Loader2, Download, Volume2, Mic, Square, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

const FREESOUND_API_KEY = '9Zlyu8Q6bhpEENkjKrF2eScP7eVZ1Pgmpg1mxz0q';

interface Sound {
    id: number;
    name: string;
    username: string;
    duration: number;
    previews: {
        'preview-hq-mp3': string;
        'preview-lq-mp3': string;
    };
    download: string;
    description?: string;
}

interface SoundUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLocalUpload: (file: File) => void;
    onLibrarySelect: (sound: Sound) => void;
}

export const SoundUploadModal = ({ open, onOpenChange, onLocalUpload, onLibrarySelect }: SoundUploadModalProps) => {
    const [activeTab, setActiveTab] = useState<'local' | 'library' | 'record'>('local');
    const [searchQuery, setSearchQuery] = useState('');
    const [sounds, setSounds] = useState<Sound[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [playingId, setPlayingId] = useState<number | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isPlayingRecording, setIsPlayingRecording] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!open) {
            // Clean up when modal closes
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (playbackTimerRef.current) {
                clearTimeout(playbackTimerRef.current);
                playbackTimerRef.current = null;
            }
            setPlayingId(null);
            setSearchQuery('');
            setSounds([]);
            setHasSearched(false);
            setActiveTab('local');
            setCurrentPage(1);
            setTotalPages(0);
            // Clean up recording state
            stopRecording();
            setRecordedAudio(null);
            setRecordingDuration(0);
            setIsPlayingRecording(false);
            setRecordingError(null);
        } else {
            // Clear error when modal opens or tab changes
            setRecordingError(null);
        }
    }, [open]);
    
    // Clear error when changing tabs
    useEffect(() => {
        setRecordingError(null);
    }, [activeTab]);

    useEffect(() => {
        const scrollViewport = scrollViewportRef.current;
        if (!scrollViewport) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            
            if (isNearBottom && !isLoadingMore && currentPage < totalPages) {
                loadMoreSounds();
            }
        };

        scrollViewport.addEventListener('scroll', handleScroll);
        return () => scrollViewport.removeEventListener('scroll', handleScroll);
    }, [isLoadingMore, currentPage, totalPages, searchQuery]);

    const searchSounds = async () => {
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        setHasSearched(true);
        setCurrentPage(1);
        
        try {
            const response = await fetch(
                `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(searchQuery)}&fields=id,name,username,duration,previews,download,description&token=${FREESOUND_API_KEY}&page=1&page_size=15`
            );
            const data = await response.json();
            setSounds(data.results || []);
            setTotalPages(Math.ceil(data.count / 15) || 0);
        } catch (error) {
            console.error('Error searching sounds:', error);
            setSounds([]);
        } finally {
            setIsSearching(false);
        }
    };

    const togglePlayPreview = (sound: Sound) => {
        if (playingId === sound.id) {
            // Stop playing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (playbackTimerRef.current) {
                clearTimeout(playbackTimerRef.current);
                playbackTimerRef.current = null;
            }
            setPlayingId(null);
        } else {
            // Start playing
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (playbackTimerRef.current) {
                clearTimeout(playbackTimerRef.current);
            }
            
            const audio = new Audio(sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3']);
            audio.play();
            audioRef.current = audio;
            setPlayingId(sound.id);
            
            // Limit playback to 5 seconds
            playbackTimerRef.current = setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                setPlayingId(null);
                playbackTimerRef.current = null;
            }, 5000);
            
            audio.onended = () => {
                if (playbackTimerRef.current) {
                    clearTimeout(playbackTimerRef.current);
                    playbackTimerRef.current = null;
                }
                setPlayingId(null);
                audioRef.current = null;
            };
        }
    };

    const handleSelectSound = async (sound: Sound) => {
        // Stop any playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingId(null);
        
        onLibrarySelect(sound);
        onOpenChange(false);
    };

    const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onLocalUpload(file);
            onOpenChange(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const truncateText = (text: string, maxLength: number = 60) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const loadMoreSounds = async () => {
        if (isLoadingMore || currentPage >= totalPages) return;
        
        setIsLoadingMore(true);
        
        try {
            const response = await fetch(
                `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(searchQuery)}&fields=id,name,username,duration,previews,download,description&token=${FREESOUND_API_KEY}&page=${currentPage + 1}&page_size=15`
            );
            const data = await response.json();
            setSounds(prevSounds => [...prevSounds, ...data.results]);
            setTotalPages(Math.ceil(data.count / 15) || 0);
            setCurrentPage(prevPage => prevPage + 1);
        } catch (error) {
            console.error('Error loading more sounds:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleScrollAreaMount = (node: HTMLDivElement | null) => {
        if (node) {
            // Find the actual scrollable viewport within the ScrollArea
            const viewport = node.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
            if (viewport) {
                scrollViewportRef.current = viewport;
            }
        }
    };

    // Recording functions
    const startRecording = async () => {
        if (isRecording) return;
        
        // Clear any previous errors
        setRecordingError(null);
        
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setRecordingError('Your browser does not support microphone recording. Please use a modern browser like Chrome, Firefox, or Edge.');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setRecordedAudio(audioBlob);
                
                // Stop all tracks to turn off microphone
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            setRecordingError(null);
            
            recordingTimerRef.current = window.setInterval(() => {
                setRecordingDuration(prevDuration => prevDuration + 1);
            }, 1000);
        } catch (error: any) {
            console.error('Error starting recording:', error);
            
            let errorMessage = 'Could not access microphone. ';
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Please allow microphone access in your browser settings and try again.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'No microphone found. Please connect a microphone and try again.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Your microphone is already in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += 'Microphone constraints could not be satisfied.';
            } else if (error.name === 'SecurityError') {
                errorMessage += 'Microphone access is blocked. Please enable HTTPS or check your browser settings.';
            } else {
                errorMessage += 'An unknown error occurred. Please try again.';
            }
            
            setRecordingError(errorMessage);
        }
    };

    const stopRecording = () => {
        if (!isRecording) return;
        
        const mediaRecorder = mediaRecorderRef.current;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setIsRecording(false);
    };

    const playRecordedAudio = () => {
        if (!recordedAudio) return;
        
        const audio = new Audio(URL.createObjectURL(recordedAudio));
        audio.play();
        recordedAudioRef.current = audio;
        setIsPlayingRecording(true);
        
        audio.onended = () => {
            setIsPlayingRecording(false);
            recordedAudioRef.current = null;
        };
    };

    const stopPlayingRecording = () => {
        const audio = recordedAudioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        setIsPlayingRecording(false);
        recordedAudioRef.current = null;
    };

    const handleRecordedAudioUpload = () => {
        if (!recordedAudio) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([recordedAudio], `recording_${timestamp}.wav`, { type: 'audio/wav' });
        onLocalUpload(file);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] max-h-[700px] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle>Upload Audio</DialogTitle>
                    <DialogDescription>Upload from your computer, record from microphone, or browse the sound library.</DialogDescription>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex border-b px-6">
                    <button
                        onClick={() => setActiveTab('local')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'local'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Upload className="w-4 h-4 inline mr-2" />
                        Upload from Computer
                    </button>
                    <button
                        onClick={() => setActiveTab('record')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'record'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Mic className="w-4 h-4 inline mr-2" />
                        Record Audio
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'library'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Search className="w-4 h-4 inline mr-2" />
                        Browse Sound Library
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'local' ? (
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-4 max-w-md">
                                <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center">
                                    <Upload className="w-12 h-12 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Upload Audio File</h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Select an audio file from your computer to upload
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Choose File
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={handleLocalFileSelect}
                                />
                                <p className="text-xs text-slate-400">
                                    Supports MP3, WAV, OGG, and other audio formats
                                </p>
                            </div>
                        </div>
                    ) : activeTab === 'record' ? (
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-6 max-w-md w-full">
                                {recordingError ? (
                                    <div className="bg-red-50 border border-red-300 rounded-lg p-5 space-y-3">
                                        <div className="flex items-center gap-3 text-red-900">
                                            <Mic className="w-5 h-5" />
                                            <h3 className="font-semibold">Microphone Access Denied</h3>
                                        </div>
                                        <p className="text-sm text-red-700">
                                            Click the microphone icon in your browser's address bar and allow access.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => {
                                                    setRecordingError(null);
                                                    startRecording();
                                                }}
                                                className="flex-1"
                                            >
                                                Try Again
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setRecordingError(null);
                                                    setActiveTab('local');
                                                }}
                                                variant="outline"
                                            >
                                                Upload File Instead
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
                                            isRecording ? 'bg-red-50 animate-pulse' : 'bg-indigo-50'
                                        }`}>
                                            {isRecording ? (
                                                <Mic className="w-12 h-12 text-red-600" />
                                            ) : recordedAudio ? (
                                                <Volume2 className="w-12 h-12 text-indigo-600" />
                                            ) : (
                                                <Mic className="w-12 h-12 text-indigo-600" />
                                            )}
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">
                                                {isRecording ? 'Recording...' : recordedAudio ? 'Recording Complete' : 'Record Audio'}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {isRecording 
                                                    ? `Duration: ${formatDuration(recordingDuration)}`
                                                    : recordedAudio
                                                    ? `Recorded ${formatDuration(recordingDuration)}`
                                                    : 'Record audio directly from your microphone'
                                                }
                                            </p>
                                        </div>
                                        
                                        {!recordedAudio ? (
                                            <>
                                                <Button
                                                    size="lg"
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className="w-full"
                                                    variant={isRecording ? 'destructive' : 'default'}
                                                >
                                                    {isRecording ? (
                                                        <>
                                                            <Square className="w-4 h-4 mr-2" />
                                                            Stop Recording
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Mic className="w-4 h-4 mr-2" />
                                                            Start Recording
                                                        </>
                                                    )}
                                                </Button>
                                                {!isRecording && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                                                        <p className="text-xs text-amber-800">
                                                            <strong>📌 Important:</strong> Your browser will ask for microphone permission. 
                                                            Please click "Allow" in the permission popup that appears at the top of your browser.
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="lg"
                                                        onClick={isPlayingRecording ? stopPlayingRecording : playRecordedAudio}
                                                        className="flex-1"
                                                        variant="outline"
                                                    >
                                                        {isPlayingRecording ? (
                                                            <>
                                                                <Pause className="w-4 h-4 mr-2" />
                                                                Pause
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="w-4 h-4 mr-2" />
                                                                Play Preview
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="lg"
                                                        onClick={() => {
                                                            setRecordedAudio(null);
                                                            setRecordingDuration(0);
                                                        }}
                                                        variant="outline"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <Button
                                                    size="lg"
                                                    onClick={handleRecordedAudioUpload}
                                                    className="w-full"
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Use This Recording
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Search Bar */}
                            <div className="p-6 border-b">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="Search for sounds... (e.g., 'birds', 'rain', 'footsteps')"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && searchSounds()}
                                            className="pl-10"
                                        />
                                    </div>
                                    <Button onClick={searchSounds} disabled={isSearching || !searchQuery.trim()}>
                                        {isSearching ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Search'
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            <div className="flex-1 overflow-hidden" ref={handleScrollAreaMount}>
                                <ScrollArea className="h-full">
                                    <div className="p-6">
                                        {!hasSearched ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm">Search for sounds from Freesound.org</p>
                                                <p className="text-xs mt-2">Try searching for: ambient, nature, music, effects</p>
                                            </div>
                                        ) : isSearching ? (
                                            <div className="text-center py-12">
                                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-4" />
                                                <p className="text-sm text-slate-500">Searching sounds...</p>
                                            </div>
                                        ) : sounds.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <p className="text-sm">No sounds found. Try a different search term.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {sounds.map((sound) => (
                                                    <div
                                                        key={sound.id}
                                                        className="flex items-start gap-3 p-4 bg-white border rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group max-w-full"
                                                    >
                                                        {/* Play/Pause Button */}
                                                        <button
                                                            onClick={() => togglePlayPreview(sound)}
                                                            className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center hover:bg-indigo-200 transition-colors shrink-0"
                                                        >
                                                            {playingId === sound.id ? (
                                                                <Pause className="w-5 h-5 text-indigo-600" />
                                                            ) : (
                                                                <Play className="w-5 h-5 text-indigo-600 ml-0.5" />
                                                            )}
                                                        </button>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0 max-w-[calc(100%-140px)]">
                                                            <h4 className="font-medium text-sm break-words">{truncateText(sound.name)}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                                                                <span className="truncate max-w-[150px]">by {sound.username}</span>
                                                                <span>•</span>
                                                                <span>{formatDuration(sound.duration)}</span>
                                                            </div>
                                                            {sound.description && (
                                                                <p className="text-xs text-slate-500 mt-1 break-words">
                                                                    {truncateText(sound.description)}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Select Button */}
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSelectSound(sound)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                        >
                                                            <Download className="w-4 h-4 mr-2" />
                                                            Select
                                                        </Button>
                                                    </div>
                                                ))}
                                                {isLoadingMore && (
                                                    <div className="text-center py-4">
                                                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-600" />
                                                        <p className="text-xs text-slate-500 mt-2">Loading more sounds...</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};