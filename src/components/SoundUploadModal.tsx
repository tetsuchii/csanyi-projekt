import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, Play, Pause, Loader2, Download, Volume2 } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'local' | 'library'>('local');
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

    useEffect(() => {
        if (!open) {
            // Clean up when modal closes
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingId(null);
            setSearchQuery('');
            setSounds([]);
            setHasSearched(false);
            setActiveTab('local');
            setCurrentPage(1);
            setTotalPages(0);
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
            setPlayingId(null);
        } else {
            // Start playing
            if (audioRef.current) {
                audioRef.current.pause();
            }
            
            const audio = new Audio(sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3']);
            audio.play();
            audioRef.current = audio;
            setPlayingId(sound.id);
            
            audio.onended = () => {
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