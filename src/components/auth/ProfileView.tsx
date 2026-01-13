import React, { useState, useEffect } from 'react';
import { supabase } from './AuthView';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { User, Mail, LogOut, Shield, Check, AlertCircle, ArrowLeft, HelpCircle } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { projectId } from '../../utils/supabase/info';

export const ProfileView = ({ onBack, onSignOut, onShowOnboarding }: { onBack: () => void, onSignOut: () => void, onShowOnboarding?: () => void }) => {
    const [user, setUser] = useState<any>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [inviteStatus, setInviteStatus] = useState<{type: 'success'|'error', message: string} | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsInviting(true);
        setInviteStatus(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session");

            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-5be515e6/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ email: inviteEmail })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Invitation failed");
            }

            setInviteStatus({ type: 'success', message: "Invitation sent successfully!" });
            setInviteEmail("");
        } catch (err: any) {
            setInviteStatus({ type: 'error', message: err.message || "Failed to send invitation" });
        } finally {
            setIsInviting(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        onSignOut();
    };

    if (!user) return <div className="p-8 text-center">Loading profile...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <Button variant="ghost" onClick={onBack} className="mb-4 pl-0 hover:bg-transparent hover:text-indigo-600">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Gallery
                </Button>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                    <User className="w-8 h-8" />
                                </div>
                                <div>
                                    <CardTitle>{user.user_metadata?.full_name || "User"}</CardTitle>
                                    <CardDescription>{user.email}</CardDescription>
                                </div>
                            </div>
                            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleSignOut}>
                                <LogOut className="w-4 h-4 mr-2" /> Sign Out
                            </Button>
                        </div>
                    </CardHeader>
                    {onShowOnboarding && (
                        <CardContent className="border-t pt-6">
                             <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium">App Tutorial</h4>
                                    <p className="text-sm text-slate-500">Replay the onboarding tour to learn how to use the app.</p>
                                </div>
                                <Button variant="secondary" onClick={onShowOnboarding}>
                                    <HelpCircle className="w-4 h-4 mr-2" /> View Tutorial
                                </Button>
                             </div>
                        </CardContent>
                    )}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-600" />
                            Admin Controls
                        </CardTitle>
                        <CardDescription>Invite new members to join the workspace.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleInvite} className="space-y-4">
                            {inviteStatus && (
                                <Alert variant={inviteStatus.type === 'success' ? 'default' : 'destructive'} className={inviteStatus.type === 'success' ? "border-green-200 bg-green-50 text-green-800" : ""}>
                                    {inviteStatus.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    <AlertDescription>{inviteStatus.message}</AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <Label htmlFor="invite-email" className="sr-only">Email address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input 
                                            id="invite-email" 
                                            placeholder="colleague@example.com" 
                                            className="pl-9"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                            type="email"
                                        />
                                    </div>
                                </div>
                                <Button type="submit" disabled={isInviting}>
                                    {isInviting ? "Sending..." : "Send Invite"}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                An email invitation will be sent to this address. They will be able to sign up and access the shared projects.
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
