import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface AudioConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AudioConsentDialog = ({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: AudioConsentDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-2xl font-semibold text-slate-900">
              Audio Upload Consent
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 leading-relaxed text-left space-y-3">
              <p>
                Before saving this audio, please confirm that:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>You have the legal right to upload and share this audio recording</li>
                <li>You understand this audio may contain personal data</li>
                <li>You acknowledge that you are responsible for the content you upload</li>
                <li>You have obtained necessary permissions if the audio contains other people's voices</li>
              </ul>
              <p className="text-xs text-slate-500 pt-2">
                By continuing, you agree to our{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="mt-2 flex gap-2 sm:gap-2">
          <AlertDialogCancel onClick={onCancel} className="flex-1">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
          >
            I Agree
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
