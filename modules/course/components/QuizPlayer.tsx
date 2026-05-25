"use client";

import { useState } from 'react';
import { toast } from 'sonner';

interface Question {
  id: string;
  text: string;
  multipleCorrect?: boolean;
  options: { id: string; text: string; order: number }[];
}

interface QuizProps {
  courseId: string;
  quiz: {
    id: string;
    lessonId: string;
    retryLimit?: number | null;
    passingGrade?: number | null;
    questions: Question[];
  };
  attemptCount?: number;
  onComplete: (result: { score: number; passed: boolean }) => Promise<void>;
}

export default function QuizPlayer({ courseId, quiz, attemptCount = 0, onComplete }: QuizProps) {
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [currentAttemptCount, setCurrentAttemptCount] = useState(attemptCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingAttempts = quiz.retryLimit ? Math.max(0, quiz.retryLimit - currentAttemptCount) : null;
  const isLocked = quiz.retryLimit ? remainingAttempts === 0 : false;
  const passingGrade = typeof quiz.passingGrade === 'number' ? quiz.passingGrade : 70;

  const handleSelect = (questionId: string, optionIndex: number, multipleCorrect: boolean) => {
    if (submitted || isLocked) return;
    const current = answers[questionId];
    if (!multipleCorrect) {
      setAnswers({ ...answers, [questionId]: optionIndex });
      return;
    }

    const currentArray = Array.isArray(current) ? current : typeof current === 'number' ? [current] : [];
    const exists = currentArray.includes(optionIndex);
    const next = exists ? currentArray.filter((v) => v !== optionIndex) : [...currentArray, optionIndex];
    next.sort((a, b) => a - b);
    setAnswers({ ...answers, [questionId]: next });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const allAnswered = quiz.questions.every((q) => {
        const answer = answers[q.id];
        if (q.multipleCorrect) return Array.isArray(answer) && answer.length > 0;
        return typeof answer === 'number';
      });

      if (!allAnswered) {
        setError('Silakan jawab semua pertanyaan.');
        toast.error('Silakan jawab semua pertanyaan.');
        return;
      }

      const answersArray = quiz.questions.map((q) => answers[q.id] as number | number[]);
      const res = await fetch(`/api/courses/${courseId}/lessons/${quiz.lessonId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data?.error || 'Gagal mengirim jawaban.';
        if (message === 'QUIZ_RETRY_LIMIT_REACHED') {
          setError('Batas percobaan kuis telah habis.');
          toast.error('Batas percobaan kuis telah habis.');
          return;
        }
        setError(message);
        toast.error('Gagal mengirim jawaban.');
        return;
      }

      const serverScore = typeof data?.score === 'number' ? data.score : 0;
      const serverPassed = Boolean(data?.passed);
      const serverAttemptCount = typeof data?.attemptCount === 'number' ? data.attemptCount : null;

      if (serverAttemptCount !== null) setCurrentAttemptCount(serverAttemptCount);

      setScore(serverScore);
      setPassed(serverPassed);
      setSubmitted(true);

      await onComplete({ score: serverScore, passed: serverPassed });
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'Gagal mengirim jawaban.';
      if (message === 'QUIZ_RETRY_LIMIT_REACHED') {
        setError('Batas percobaan kuis telah habis.');
        toast.error('Batas percobaan kuis telah habis.');
      } else {
        setError('Gagal mengirim jawaban. Silakan coba lagi.');
        toast.error('Gagal mengirim jawaban.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked && !submitted) {
      return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
              <h3 className="text-xl font-bold text-amber-800 mb-2">Akses Kuis Terkunci</h3>
              <p className="text-amber-700">Anda telah mencapai batas maksimal percobaan ({quiz.retryLimit}x) untuk kuis ini.</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Quiz Time!</h2>
        {quiz.retryLimit && (
            <span className="text-sm font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                Sisa Percobaan: {remainingAttempts}x
            </span>
        )}
      </div>
      
      {quiz.questions.map((q, index) => (
        <div key={q.id} className="space-y-3">
          <p className="font-medium text-lg">{index + 1}. {q.text}</p>
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              (() => {
                const answer = answers[q.id];
                const isSelected = q.multipleCorrect ? Array.isArray(answer) && answer.includes(i) : answer === i;
                return (
              <button
                key={opt.id || i}
                onClick={() => handleSelect(q.id, i, Boolean(q.multipleCorrect))}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'hover:bg-gray-50 border-gray-200'
                }`}
                disabled={submitted || isLocked}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium ${
                    isSelected ? 'border-current' : 'border-gray-300 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span>{opt.text}</span>
                </div>
              </button>
                );
              })()
            ))}
          </div>
        </div>
      ))}

      {!submitted ? (
        <div className="flex justify-end flex-col items-end gap-2">
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={
              quiz.questions.some((q) => {
                const answer = answers[q.id];
                if (q.multipleCorrect) return !Array.isArray(answer) || answer.length === 0;
                return typeof answer !== 'number';
              }) || isSubmitting
            }
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? 'Mengirim...' : 'Submit Quiz'}
          </button>
        </div>
      ) : (
        <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-2xl font-bold text-slate-900">Skor Anda: {score}%</p>
          <p className="text-slate-600 mt-2 mb-4">
            {passed || score >= passingGrade ? 'Selamat! Anda lulus kuis ini.' : 'Jangan menyerah, coba lagi!'}
          </p>
          
          {!isLocked && score < 100 && (
             <button 
               onClick={() => {
                   setSubmitted(false);
                   setScore(0);
                   setPassed(false);
                   setAnswers({});
                   setError(null);
               }}
               className="text-indigo-600 font-medium hover:underline text-sm"
             >
               Coba Lagi (Sisa {remainingAttempts !== null ? remainingAttempts : '∞'})
             </button>
          )}
        </div>
      )}
    </div>
  );
}
