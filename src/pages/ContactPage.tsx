import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Database, ExternalLink, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { submitContactForm } from '../services/apiClient.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    id: string;
    name: string;
    createdAt: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Please enter a subject (at least 3 characters).');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please enter a message of at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmittedRecord({
        id: response.submission.id,
        name: response.submission.name,
        createdAt: response.submission.createdAt,
      });
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save contact message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />

        <RevealOnScroll className="mb-10 max-w-2xl">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
              Research Inquiries
            </span>
          </div>
          <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
            Contact <span className="italic text-[#D97B29]">Mission Team</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#C2BCB2]">
            Submit research inquiries, NASA NTRS dataset feedback, or hackathon collaboration messages directly to the Flame in Freefall database.
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Contact Form */}
          <div className="lg:col-span-7">
            <RevealOnScroll>
              <form onSubmit={handleSubmit} className="editorial-panel p-6 sm:p-8 space-y-5">
                {submittedRecord && (
                  <div className="border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <div className="font-semibold text-[#F3EFE8]">
                          Inquiry saved for {submittedRecord.name}
                        </div>
                        <p className="mt-1 text-xs text-emerald-200/85">
                          Reference ID: <span className="font-mono-data">{submittedRecord.id}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="border border-red-500/35 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#A9A39A]"
                    >
                      Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Elena Vance"
                      className="w-full border border-white/15 bg-[#060607] px-4 py-2.5 text-sm text-[#F3EFE8] placeholder-[#8A847B] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#A9A39A]"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="researcher@agency.gov"
                      className="w-full border border-white/15 bg-[#060607] px-4 py-2.5 text-sm text-[#F3EFE8] placeholder-[#8A847B] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-subject"
                    className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#A9A39A]"
                  >
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Artemis cabin flammability validation dataset"
                    className="w-full border border-white/15 bg-[#060607] px-4 py-2.5 text-sm text-[#F3EFE8] placeholder-[#8A847B] focus:border-[#D97B29] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#A9A39A]"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your feedback, experimental dataset reference, or collaboration details..."
                    className="w-full border border-white/15 bg-[#060607] px-4 py-3 text-sm text-[#F3EFE8] placeholder-[#8A847B] focus:border-[#D97B29] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex cursor-pointer items-center gap-2.5 border border-[#D97B29]/80 bg-[#D97B29]/12 px-7 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting Message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </RevealOnScroll>
          </div>

          {/* Right: Mission & Data Attribution */}
          <div className="lg:col-span-5 space-y-5">
            <div className="editorial-panel p-6">
              <div className="mb-3 flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#D97B29]" />
                <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">NASA Hackathon 2026</h2>
              </div>
              <p className="text-xs leading-relaxed text-[#C2BCB2]">
                Flame in Freefall is an AI-powered microgravity fire research platform designed around verified ISS and Cygnus space combustion campaigns.
              </p>
            </div>

            <div className="editorial-panel p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#F3EFE8]">
                <Database className="h-4 w-4 text-[#D97B29]" />
                <span>Verified Primary Sources</span>
              </div>
              <p className="text-xs leading-relaxed text-[#C2BCB2]">
                All indexed experiment data and citations link directly to NASA Technical Reports Server (NTRS) records for BASS, BASS-II, Saffire, FLEX-2, CFI, SAME-R, ACME-BRE, and SPICE.
              </p>
              <a
                href="https://ntrs.nasa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D97B29] hover:text-[#E68A38] hover:underline"
              >
                <span>Open NASA Technical Reports Server (NTRS)</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="editorial-panel p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-[#F3EFE8] mb-3">
                <ShieldCheck className="h-4 w-4 text-[#D97B29]" />
                <span>Quick Navigation</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  to="/experiments"
                  className="border border-white/15 bg-[#060607] px-3 py-1.5 text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                >
                  Experiments Explorer
                </Link>
                <Link
                  to="/ranking"
                  className="border border-white/15 bg-[#060607] px-3 py-1.5 text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                >
                  Safety Rankings
                </Link>
                <Link
                  to="/prediction"
                  className="border border-white/15 bg-[#060607] px-3 py-1.5 text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                >
                  Fire Risk Predictor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
