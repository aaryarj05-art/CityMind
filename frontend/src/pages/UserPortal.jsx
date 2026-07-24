import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, MapPin, Send, X } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import { userAPI } from '../services/api';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const UserPortal = () => {
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('12.2958');
  const [longitude, setLongitude] = useState('76.6394');
  const [readableAddress, setReadableAddress] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const urls = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(urls);
    return () => urls.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  const canSubmit = useMemo(() => (
    description.trim().length > 0 && readableAddress.trim().length > 0 && files.length > 0 && latitude !== '' && longitude !== '' && !submitting
  ), [description, readableAddress, files.length, latitude, longitude, submitting]);

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    setError('');
    const invalid = selected.find((file) => !ACCEPTED_TYPES.includes(file.type));
    if (invalid) {
      setFiles([]);
      setError('Upload JPG, JPEG, PNG, or WEBP incident images only.');
      return;
    }
    setFiles(selected);
  };

  const removeFile = (name) => {
    setFiles((current) => current.filter((file) => file.name !== name));
  };

  const submitReport = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Enter valid latitude and longitude values.');
      return;
    }
    const formData = new FormData();
    formData.append('description', description.trim());
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lng));
    formData.append('readable_address', readableAddress.trim());
    files.forEach((file) => formData.append('images', file));

    setSubmitting(true);
    try {
      const { data } = await userAPI.submitReport(formData);
      setResult(data);
      setDescription('');
      setReadableAddress('');
      setFiles([]);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to submit eyewitness report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer title="User">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-xl border border-navy-700 bg-navy-800 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-2 text-cyan-200">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Citizen Incident Report</h1>
              <p className="mt-1 text-sm text-slate-400">Submit eyewitness image evidence for CityMind verification.</p>
            </div>
          </div>
        </div>

        <form onSubmit={submitReport} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4 rounded-xl border border-navy-700 bg-navy-800 p-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Incident Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={7}
                className="mt-2 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Describe what you saw, including visible hazards, people affected, and nearby landmarks."
              />
              <span className="mt-1 block text-xs text-slate-500">{description.length}/500 characters</span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Latitude</span>
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Longitude</span>
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Readable Address</span>
              <div className="relative mt-2">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={readableAddress}
                  onChange={(event) => setReadableAddress(event.target.value)}
                  className="w-full rounded-lg border border-navy-700 bg-navy-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
                  placeholder="Example: Sayyaji Rao Road near Devaraja Market"
                  required
                />
              </div>
            </label>
          </section>

          <section className="space-y-4 rounded-xl border border-navy-700 bg-navy-800 p-5">
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/25 bg-navy-950/60 p-5 text-center transition-colors hover:border-cyan-300/45 hover:bg-navy-950">
              <ImagePlus className="h-8 w-8 text-cyan-300" />
              <span className="mt-3 text-sm font-semibold text-white">Upload incident image evidence</span>
              <span className="mt-1 text-xs text-slate-500">JPG, JPEG, PNG, or WEBP. Up to 5 MB each.</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} className="sr-only" />
            </label>

            {previews.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {previews.map((preview) => (
                  <div key={preview.name} className="relative overflow-hidden rounded-lg border border-navy-700 bg-navy-950">
                    <img src={preview.url} alt={preview.name} className="aspect-video w-full object-cover" />
                    <button type="button" onClick={() => removeFile(preview.name)} className="absolute right-2 top-2 rounded-md bg-navy-950/80 p-1 text-slate-300 hover:text-white" aria-label={`Remove ${preview.name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Report submitted for verification
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-50/80">
                  <span>Report #{result.id}</span>
                  <span>Incident #{result.incident_id}</span>
                  <span>{result.verification_status}</span>
                  <span>{result.match_status}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-500 px-4 py-2.5 text-sm font-bold text-navy-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:border-navy-700 disabled:bg-navy-700 disabled:text-slate-500"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </button>
          </section>
        </form>
      </div>
    </PageContainer>
  );
};

export default UserPortal;