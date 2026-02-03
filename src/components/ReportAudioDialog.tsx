import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Flag, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface ReportAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  hotspotId: string;
}

export const ReportAudioDialog = ({
  open,
  onOpenChange,
  projectId,
  hotspotId,
}: ReportAudioDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    'Inappropriate content',
    'Copyright violation',
    'Spam or misleading',
    'Privacy violation',
    'Other safety concern',
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/make-server-5be515e6/report-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            hotspotId,
            reason: selectedReason,
          }),
        }
      );

      if (response.ok) {
        setSubmitted(true);
        toast.success('Report submitted successfully');
        setTimeout(() => {
          onOpenChange(false);
          setSubmitted(false);
          setSelectedReason('');
        }, 2000);
      } else {
        toast.error('Failed to submit report');
      }
    } catch (error) {
      console.error('Report submission error:', error);
      toast.error('An error occurred while submitting the report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-600" />
                Report Audio
              </DialogTitle>
              <DialogDescription>
                Help us keep the platform safe by reporting inappropriate or harmful content.
                Your report is anonymous.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-4">
              <p className="text-sm font-medium text-slate-700 mb-3">
                Why are you reporting this audio?
              </p>
              {reasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedReason === reason
                      ? 'border-red-600 bg-red-50 text-red-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="mb-2">Report Submitted</DialogTitle>
            <DialogDescription>
              Thank you for helping keep our community safe.
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
