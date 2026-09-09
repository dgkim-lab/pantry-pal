"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

type BarcodeScannerProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
};

export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState("");
  const [startAttempt, setStartAttempt] = useState(0);

  useEffect(() => {
    if (!open) {
      if (startAttempt !== 0) setStartAttempt(0);
      return;
    }
    if (startAttempt === 0 || !videoRef.current) return;

    const preview = videoRef.current;
    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    let stream: MediaStream | undefined;
    const reader = new BrowserMultiFormatReader();
    detectedRef.current = false;
    setError("");

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const nextControls = await reader.decodeFromStream(stream, preview, (result) => {
          if (!result || cancelled || detectedRef.current) return;
          detectedRef.current = true;
          onDetected(result.getText());
        });
        if (cancelled) nextControls.stop();
        else controls = nextControls;
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setError("Unable to access the camera. Check your browser permission and use HTTPS.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      controls?.stop();
      if (!controls) stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onDetected, startAttempt]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Scan barcode</DialogTitle>
      <DialogContent>
        <div className="barcode-scanner-preview">
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="barcode-scanner-target" aria-hidden="true" />
        </div>
        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : startAttempt === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Tap “Allow camera” to request access and start scanning.
          </Typography>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Center the barcode in the frame. Scanning happens on this device.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setError(""); setStartAttempt((attempt) => attempt + 1); }}>
          {startAttempt === 0 ? "Allow camera" : "Try again"}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
