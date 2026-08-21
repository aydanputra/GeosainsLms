"use client";

import { Download, FileText, Paperclip, X } from 'lucide-react';
import RichContentRenderer from './RichContentRenderer';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import LessonAttachmentModal from '@/modules/media/components/LessonAttachmentModal';

function hasMeaningfulText(value: any): boolean {
  if (!value) return false;
  if (typeof value === 'string') {
    const text = value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 0;
  }
  if (typeof value !== 'object') return false;

  const visit = (node: any): boolean => {
    if (!node) return false;
    if (typeof node === 'string') return node.trim().length > 0;
    if (typeof node !== 'object') return false;
    if (typeof node.text === 'string' && node.text.trim().length > 0) return true;
    if (Array.isArray(node)) return node.some(visit);
    if (Array.isArray(node.content)) return node.content.some(visit);
    return false;
  };

  return visit(value);
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  timeLimit?: number | null;
  passingGrade: number;
  maxFileSize: number;
}

interface AssignmentSubmission {
  id: string;
  notes: string | null;
  grade: number | null;
  feedback: string | null;
  status: 'PENDING' | 'GRADED' | 'REJECTED';
  submittedAt: string | Date;
  gradedAt: string | Date | null;
  downloadUrl: string;
  downloadUrls?: string[];
}

interface LessonViewerProps {
  lesson: {
    id: string;
    title: string;
    type: string;
    content: any;
    videoId: string | null;
    attachments?: Attachment[];
    assignment?: Assignment | null;
  };
  onComplete: () => void;
}

export default function LessonViewer({ lesson, onComplete }: LessonViewerProps) {
  const assignment = lesson.assignment || null;
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submissionMeta, setSubmissionMeta] = useState<{
    allowResubmission: boolean;
    maxResubmissionAttempts: number;
    fileUploadLimit: number;
    attemptsUsed: number;
    attemptsLeft: number;
  } | null>(null);

  const maxBytes = useMemo(() => {
    const maxMb = assignment?.maxFileSize || 0;
    return maxMb > 0 ? maxMb * 1024 * 1024 : 0;
  }, [assignment?.maxFileSize]);

  useEffect(() => {
    if (!assignment?.id) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingSubmission(true);
      try {
        const res = await fetch(`/api/assignments/${assignment.id}/submissions`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSubmission(data?.submission || null);
          setSubmissionMeta(data?.meta || null);
        }
      } catch {
      } finally {
        if (!cancelled) setIsLoadingSubmission(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [assignment?.id]);

  const handleSubmitAssignment = async () => {
    if (!assignment?.id) return;
    if (selectedFiles.length === 0) {
      toast.error('Pilih file jawaban terlebih dahulu');
      return;
    }
    if (submissionMeta && selectedFiles.length > submissionMeta.fileUploadLimit) {
      toast.error(`Maksimal ${submissionMeta.fileUploadLimit} file per submission`);
      return;
    }
    if (maxBytes > 0) {
      for (const f of selectedFiles) {
        if (f.size > maxBytes) {
          toast.error(`Ukuran file maksimal ${assignment.maxFileSize}MB per file`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      for (const f of selectedFiles) fd.append('files', f);
      if (notes.trim()) fd.append('notes', notes.trim());

      const res = await fetch(`/api/assignments/${assignment.id}/submissions`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal mengunggah jawaban');
        return;
      }

      setSubmission(data?.submission || null);
      setSelectedFiles([]);
      setNotes('');
      if (submissionMeta) {
        const nextUsed = Math.max(0, Number(submissionMeta.attemptsUsed || 0) + 1);
        const limit = Math.max(1, Number(submissionMeta.maxResubmissionAttempts || 1));
        setSubmissionMeta({
          ...submissionMeta,
          attemptsUsed: nextUsed,
          attemptsLeft: Math.max(0, limit - nextUsed),
        });
      }
      toast.success('Jawaban berhasil dikirim');
    } catch {
      toast.error('Gagal mengunggah jawaban');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedFileItems = useMemo(() => {
    return selectedFiles.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}`,
      name: f.name,
      type: f.type || 'file',
      url: '',
    }));
  }, [selectedFiles]);

  const canSubmit = useMemo(() => {
    if (!assignment?.id) return false;
    if (isSubmitting) return false;
    if (submissionMeta?.allowResubmission) {
      return !(typeof submissionMeta.attemptsLeft === 'number' && submissionMeta.attemptsLeft <= 0);
    }
    return !(submission && submission.status === 'GRADED');
  }, [assignment?.id, isSubmitting, submission, submissionMeta]);

  const showLessonContent = useMemo(() => hasMeaningfulText(lesson.content), [lesson.content]);
  const showAssignmentDescription = useMemo(() => hasMeaningfulText(assignment?.description), [assignment?.description]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1>
      
      {lesson.type === 'VIDEO' && lesson.videoId && (
        <div className="aspect-w-16 aspect-h-9 bg-black rounded-xl overflow-hidden shadow-lg">
          <iframe
            src={`https://www.youtube.com/embed/${lesson.videoId}`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full min-h-[400px]"
          ></iframe>
        </div>
      )}

      {showLessonContent ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <RichContentRenderer content={lesson.content} />
        </div>
      ) : null}

      {assignment && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{assignment.title}</h3>
              <p className="text-xs text-slate-700 font-medium mt-1">
                Nilai lulus {assignment.passingGrade}% • Maks {assignment.maxFileSize}MB
                {submissionMeta ? ` • Maks ${submissionMeta.fileUploadLimit} file` : ''}
              </p>
              {submissionMeta ? (
                <p className="text-xs text-slate-600 mt-1">
                  {submissionMeta.allowResubmission
                    ? `Percobaan: ${submissionMeta.attemptsUsed}/${submissionMeta.maxResubmissionAttempts} • Sisa ${submissionMeta.attemptsLeft}`
                    : 'Kirim ulang: Nonaktif'}
                </p>
              ) : null}
            </div>
            {submission?.status && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200 shrink-0">
                {submission.status}
              </span>
            )}
          </div>

          {showAssignmentDescription ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <RichContentRenderer content={assignment.description ?? ''} />
            </div>
          ) : null}

          {isLoadingSubmission ? (
            <div className="text-sm text-slate-700">Memuat status tugas...</div>
          ) : submission ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">Submission</div>
                  {typeof submission.grade === 'number' ? (
                    <div className="text-xs text-slate-600 mt-1">Nilai: {submission.grade}</div>
                  ) : null}
                </div>
                {Array.isArray(submission.downloadUrls) && submission.downloadUrls.length > 1 ? (
                  <div className="flex items-center gap-2">
                    {submission.downloadUrls.slice(0, 2).map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100"
                      >
                        <Download className="w-4 h-4" />
                        File {idx + 1}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    href={submission.downloadUrl}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100"
                  >
                    <Download className="w-4 h-4" />
                    Unduh
                  </a>
                )}
              </div>
              {submission.feedback ? (
                <div className="text-sm text-slate-700">
                  <span className="font-bold">Feedback:</span> {submission.feedback}
                </div>
              ) : null}
              {submission.status === 'GRADED' && submissionMeta?.allowResubmission !== true ? (
                <div className="text-xs text-slate-700 font-medium">Submission sudah dinilai. Kirim ulang dinonaktifkan.</div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-slate-700">Belum ada submission.</div>
          )}

          <div className="grid gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">File Jawaban</label>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-indigo-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <Paperclip className="w-4 h-4" />
                Upload Dokumen
              </button>
              {selectedFiles.length > 0 ? (
                <div className="grid gap-2">
                  {selectedFiles.map((f) => (
                    <div
                      key={`${f.name}-${f.size}-${f.lastModified}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{f.name}</div>
                        <div className="text-xs text-slate-600">{(f.size / (1024 * 1024)).toFixed(2)}MB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) =>
                            prev.filter((x) => !(x.name === f.name && x.size === f.size && x.lastModified === f.lastModified))
                          )
                        }
                        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-700 font-medium">Belum ada file dipilih.</div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Catatan (opsional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                disabled={!canSubmit}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmitAssignment}
                disabled={!canSubmit}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim Jawaban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignment ? (
        <LessonAttachmentModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          attachments={selectedFileItems}
          onUploadFiles={async (files) => {
            const limit = submissionMeta?.fileUploadLimit || 1;
            setSelectedFiles((prev) => {
              const merged = [...prev, ...files];
              if (merged.length > limit) {
                toast.error(`Maksimal ${limit} file per submission`);
                return merged.slice(0, limit);
              }
              return merged;
            });
          }}
          onDeleteAttachment={async (id) => {
            setSelectedFiles((prev) => prev.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== id));
          }}
          isUploading={false}
          deletingId={null}
          disabled={!canSubmit}
        />
      ) : null}

      {/* Attachments */}
      {lesson.attachments && lesson.attachments.length > 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Lampiran Materi
            </h3>
            <div className="grid gap-3">
                {lesson.attachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate">{file.name}</p>
                                <p className="text-xs text-slate-700 font-medium uppercase tracking-wider">{file.type}</p>
                            </div>
                        </div>
                        <a 
                            href={file.url} 
                            target="_blank" 
                            download 
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Unduh
                        </a>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="flex justify-end pt-6 border-t border-slate-200">
        <button
          onClick={onComplete}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-md hover:shadow-lg flex items-center gap-2"
        >
          Selesai & Lanjut
        </button>
      </div>
    </div>
  );
}
