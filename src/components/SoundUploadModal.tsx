import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, Play, Pause, Loader2, Download, Volume2, Mic, Square, RotateCcw, Check, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { AudioConsentDialog } from './AudioConsentDialog';
import { toast } from 'sonner@2.0.3';
import { 
    validateFileType, 
    validateFileSize, 
    validateAudioDuration,
    validateAudioChannels,
    formatBytes,
    formatDuration as formatDurationUtil,
    getRemainingTime,
    LIMITS,
    getAllowedExtensions 
} from '../utils/audioValidation';

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
    type?: string;
    filesize?: number;
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

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isPlayingRecording, setIsPlayingRecording] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
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
            if (recordingAudioRef.current) {
                recordingAudioRef.current.pause();
                recordingAudioRef.current = null;
            }
            setRecordedBlob(null);
            setRecordingDuration(0);
            setIsPlayingRecording(false);
            setRecordingError(null);
        }
    }, [open]);

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
            // Add filters: only MP3 and OGG, exclude WAV and uncompressed
            // Duration limit: 60 seconds max (suitable for web playback)
            const filters = 'type:(mp3 OR ogg) duration:[0 TO 60]';
            const response = await fetch(
                `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(searchQuery)}&filter=${encodeURIComponent(filters)}&fields=id,name,username,duration,previews,download,description,type,filesize&token=${FREESOUND_API_KEY}&page=1&page_size=15`
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
            // Lazy-load preview: Only create Audio element when user interacts
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (playbackTimerRef.current) {
                clearTimeout(playbackTimerRef.current);
            }
            
            // Use only preview files (low or high quality MP3/OGG), never original
            const previewUrl = sound.previews['preview-lq-mp3'] || sound.previews['preview-hq-mp3'];
            if (!previewUrl) {
                toast.error('Preview not available for this sound');
                return;
            }
            
            const audio = new Audio(previewUrl);
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
        try {
            // Stop any playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingId(null);
            
            // Fetch detailed sound info to validate preview file metadata
            toast.loading('Validating audio file...');
            const detailResponse = await fetch(
                `https://freesound.org/apiv2/sounds/${sound.id}/?token=${FREESOUND_API_KEY}`
            );
            
            if (!detailResponse.ok) {
                toast.dismiss();
                toast.error('Failed to validate audio file');
                return;
            }
            
            const detailData = await detailResponse.json();
            
            // Check if format is allowed (must be mp3 or ogg)
            const fileType = detailData.type?.toLowerCase();
            if (fileType && !['mp3', 'ogg'].includes(fileType)) {
                toast.dismiss();
                toast.error('This audio format is not supported. Only MP3 and OGG are allowed.');
                return;
            }
            
            // Validate duration (max 60 seconds for web suitability)
            if (detailData.duration > 60) {
                toast.dismiss();
                toast.error('Audio duration exceeds 60 seconds. Please select a shorter sound.');
                return;
            }
            
            // Validate preview file size using HEAD request
            const previewUrl = detailData.previews?.['preview-lq-mp3'] || detailData.previews?.['preview-hq-mp3'];
            if (previewUrl) {
                try {
                    const headResponse = await fetch(previewUrl, { method: 'HEAD' });
                    const contentLength = headResponse.headers.get('Content-Length');
                    if (contentLength) {
                        const sizeInBytes = parseInt(contentLength, 10);
                        const sizeInMB = sizeInBytes / (1024 * 1024);
                        
                        // Reject if preview exceeds 1 MB
                        if (sizeInMB > 1) {
                            toast.dismiss();
                            toast.error(`Preview file is ${sizeInMB.toFixed(2)} MB, which exceeds the 1 MB limit.`);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('Could not validate preview file size:', error);
                    // Continue anyway if we can't check size
                }
            }
            
            toast.dismiss();
            onLibrarySelect(detailData);
            onOpenChange(false);
        } catch (error) {
            toast.dismiss();
            console.error('Error validating sound:', error);
            toast.error('An error occurred while validating the audio file');
        }
    };

    const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const typeValidation = validateFileType(file);
        if (!typeValidation.isValid) {
            toast.error(typeValidation.error);
            return;
        }

        // Validate file size
        const sizeValidation = validateFileSize(file.size, false);
        if (!sizeValidation.isValid) {
            toast.error(sizeValidation.error);
            return;
        }

        // Validate duration
        const durationValidation = await validateAudioDuration(file, false);
        if (!durationValidation.isValid) {
            toast.error(durationValidation.error);
            return;
        }

        onLocalUpload(file);
        onOpenChange(false);
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
            // Apply same filters as initial search: only MP3 and OGG, max 60 seconds
            const filters = 'type:(mp3 OR ogg) duration:[0 TO 60]';
            const response = await fetch(
                `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(searchQuery)}&filter=${encodeURIComponent(filters)}&fields=id,name,username,duration,previews,download,description,type,filesize&token=${FREESOUND_API_KEY}&page=${currentPage + 1}&page_size=15`
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

    // Voice recording functions
    const startRecording = async () => {
        try {
            setRecordingError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Reset chunks
            audioChunksRef.current = [];
            
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(audioBlob);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            
            // Start duration counter
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
            
        } catch (error) {
            // Handle microphone access errors gracefully
            if (error instanceof DOMException) {
                if (error.name === 'NotAllowedError') {
                    setRecordingError('Microphone permission denied. Please allow microphone access to record audio.');
                } else if (error.name === 'NotFoundError') {
                    setRecordingError('No microphone found. Please connect a microphone and try again.');
                } else {
                    console.error('Error accessing microphone:', error);
                    setRecordingError('Failed to access microphone. Please check your device settings.');
                }
            } else {
                console.error('Error accessing microphone:', error);
                setRecordingError('An unexpected error occurred while accessing the microphone.');
            }
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };
    
    const togglePlayRecording = () => {
        if (!recordedBlob) return;
        
        if (isPlayingRecording) {
            // Stop playing
            if (recordingAudioRef.current) {
                recordingAudioRef.current.pause();
                recordingAudioRef.current.currentTime = 0;
            }
            setIsPlayingRecording(false);
        } else {
            // Start playing
            const audioUrl = URL.createObjectURL(recordedBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                setIsPlayingRecording(false);
                URL.revokeObjectURL(audioUrl);
                recordingAudioRef.current = null;
            };
            
            audio.play();
            recordingAudioRef.current = audio;
            setIsPlayingRecording(true);
        }
    };
    
    const resetRecording = () => {
        if (recordingAudioRef.current) {
            recordingAudioRef.current.pause();
            recordingAudioRef.current = null;
        }
        setRecordedBlob(null);
        setRecordingDuration(0);
        setIsPlayingRecording(false);
        setRecordingError(null);
    };
    
    const useRecording = () => {
        if (!recordedBlob) return;
        
        // Convert blob to file
        const file = new File([recordedBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        onLocalUpload(file);
        onOpenChange(false);
    };
    
    const formatRecordingDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] max-h-[700px] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle>Upload Audio</DialogTitle>
                    <DialogDescription>Upload audio from your computer or browse the sound library.</DialogDescription>
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
                                    accept=".mp3,.m4a,.ogg,audio/mpeg,audio/mp4,audio/ogg"
                                    className="hidden"
                                    onChange={handleLocalFileSelect}
                                />
                                <p className="text-xs text-slate-400">
                                    Supports MP3, M4A (AAC), and OGG formats. Max 5 minutes, 10 MB.
                                </p>
                            </div>
                        </div>
                    ) : activeTab === 'record' ? (
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center space-y-6 max-w-md w-full">
                                {!recordedBlob ? (
                                    <>
                                        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
                                            isRecording ? 'bg-red-50 animate-pulse' : 'bg-indigo-50'
                                        }`}>
                                            <Mic className={`w-12 h-12 ${isRecording ? 'text-red-600' : 'text-indigo-600'}`} />
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">
                                                {isRecording ? 'Recording...' : 'Record Audio'}
                                            </h3>
                                            <p className="text-sm text-slate-500 mb-4">
                                                {isRecording 
                                                    ? 'Click stop when finished' 
                                                    : 'Click the button below to start recording'}
                                            </p>
                                        </div>

                                        {isRecording && (
                                            <div className="text-3xl font-mono font-bold text-indigo-600">
                                                {formatRecordingDuration(recordingDuration)}
                                            </div>
                                        )}

                                        {recordingError && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <p className="text-sm text-red-600">{recordingError}</p>
                                            </div>
                                        )}

                                        <Button
                                            size="lg"
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`w-full ${
                                                isRecording 
                                                    ? 'bg-red-600 hover:bg-red-700' 
                                                    : ''
                                            }`}
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

                                        <p className="text-xs text-slate-400">
                                            Make sure your microphone is connected and permissions are granted
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-24 h-24 mx-auto bg-green-50 rounded-full flex items-center justify-center">
                                            <Check className="w-12 h-12 text-green-600" />
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">Recording Complete</h3>
                                            <p className="text-sm text-slate-500 mb-2">
                                                Duration: {formatRecordingDuration(recordingDuration)}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Preview your recording or record again
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="lg"
                                                variant="outline"
                                                onClick={togglePlayRecording}
                                                className="flex-1"
                                            >
                                                {isPlayingRecording ? (
                                                    <>
                                                        <Pause className="w-4 h-4 mr-2" />
                                                        Pause
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-4 h-4 mr-2" />
                                                        Preview
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                size="lg"
                                                variant="outline"
                                                onClick={resetRecording}
                                                className="flex-1"
                                            >
                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                Re-record
                                            </Button>
                                        </div>

                                        <Button
                                            size="lg"
                                            onClick={useRecording}
                                            className="w-full"
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Use This Recording
                                        </Button>
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
                                                        className="flex items-start gap-3 p-4 bg-white border rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
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
                                                        <div className="flex-1 min-w-0 overflow-hidden">
                                                            <h4 className="font-medium text-sm truncate">{truncateText(sound.name, 25)}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                                <span className="truncate max-w-[80px]">by {sound.username}</span>
                                                                <span>•</span>
                                                                <span className="shrink-0">{formatDuration(sound.duration)}</span>
                                                            </div>
                                                            {sound.description && (
                                                                <p className="text-xs text-slate-500 mt-1 truncate">
                                                                    {truncateText(sound.description, 30)}
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