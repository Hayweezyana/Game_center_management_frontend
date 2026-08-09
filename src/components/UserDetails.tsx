import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from 'lodash';
import './CheckoutExperience.css';

interface UserDetailsProps {
  userDetails: { id?: string; username: string; phone: string; email?: string; birthday?: string };
  setUserDetails: (details: { id?: string; username: string; phone: string; email?: string; birthday?: string }) => void;
  onNext: () => void;
}

/**
 * A customer as returned by /admin/users/recent and /admin/users/search.
 *
 * Search deliberately yields a list rather than a single record: usernames are
 * not unique (five different "Favour"s is normal), so the operator picks the
 * right one using the phone number shown beside each result.
 */
interface CustomerSummary {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  lastVisit: string | null;
  visits: number;
}

const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const daysInMonth = (month: number) => new Date(2000, month, 0).getDate(); // uses leap year for Feb

const parseBirthday = (val?: string): { month: string; day: string } => {
  if (!val) return { month: '', day: '' };
  const parts = val.split('-');
  if (parts.length < 3) return { month: '', day: '' };
  return { month: String(parseInt(parts[1], 10)), day: String(parseInt(parts[2], 10)) };
};

const relativeVisit = (iso: string | null): string => {
  if (!iso) return 'No visits yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Here today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

const UserDetails: React.FC<UserDetailsProps> = ({ userDetails, setUserDetails, onNext }) => {
  const [errors, setErrors] = useState<{ username?: string; phone?: string; email?: string }>({});
  const [birthMonth, setBirthMonth] = useState(() => parseBirthday(userDetails.birthday).month);
  const [birthDay, setBirthDay] = useState(() => parseBirthday(userDetails.birthday).day);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

  // Customer picker
  const [recent, setRecent] = useState<CustomerSummary[]>([]);
  const [matches, setMatches] = useState<CustomerSummary[]>([]);
  const [searchField, setSearchField] = useState<'phone' | 'username' | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  /** Phone we just filled from a picked record — skips a redundant re-lookup. */
  const appliedPhoneRef = useRef<string | null>(null);
  /** Discards an earlier slow search that resolves after a later one. */
  const searchIdRef = useRef(0);

  // ── Prefetch the customers most likely to be at the counter ───────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/recent?limit=8`);
        if (!response.ok) return;
        const result = await response.json();
        if (!cancelled && result.success && Array.isArray(result.data)) {
          setRecent(result.data);
        }
      } catch (_error) {
        // A missing shortcut list is not worth an error message — typing still works.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Search across username AND phone ──────────────────────────────────────
  // useMemo, not useCallback: the debounced wrapper is built by an inline
  // factory, so the exhaustive-deps rule can actually see what it closes over.
  const runSearch = useMemo(
    () => debounce(async (term: string, field: 'phone' | 'username') => {
      const trimmed = term.trim();
      if (trimmed.length < 2) {
        setMatches([]);
        setIsSearching(false);
        return;
      }

      const searchId = ++searchIdRef.current;
      setIsSearching(true);
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/search?q=${encodeURIComponent(trimmed)}&limit=8`
        );
        if (!response.ok) return;
        const result = await response.json();
        if (searchId !== searchIdRef.current) return;
        if (result.success && Array.isArray(result.data)) {
          setMatches(result.data);
          setSearchField(field);
        }
      } catch (_error) {
        // Silent — the operator can always type the details in full.
      } finally {
        if (searchId === searchIdRef.current) setIsSearching(false);
      }
    }, 300),
    []
  );

  // Cancel any in-flight debounce when the form unmounts mid-typing.
  useEffect(() => () => runSearch.cancel(), [runSearch]);

  /** Fills every field from a picked record, so nothing has to be retyped. */
  const applyCustomer = useCallback(
    (customer: CustomerSummary) => {
      const parsed = parseBirthday(customer.birthday || '');
      appliedPhoneRef.current = customer.phone;

      setBirthMonth(parsed.month);
      setBirthDay(parsed.day);
      setUserDetails({
        id: customer.id,
        username: (customer.username || '').trim(),
        phone: customer.phone,
        email: customer.email || '',
        birthday: customer.birthday || '',
      });

      setIsExistingUser(true);
      setMatches([]);
      setSearchField(null);
      setErrors({});
      setSubmitError(null);
    },
    [setUserDetails]
  );

  const clearForm = () => {
    appliedPhoneRef.current = null;
    searchIdRef.current++;
    setUserDetails({ id: '', username: '', phone: '', email: '', birthday: '' });
    setBirthMonth('');
    setBirthDay('');
    setIsExistingUser(false);
    setMatches([]);
    setSearchField(null);
    setErrors({});
    setSubmitError(null);
  };

  const fetchUserDetails = useMemo(
    () => debounce(async (phone: string) => {
      if (!/^0\d{10}$/.test(phone)) return;

      setIsLoading(true);
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/phone?phone=${phone}`);

        if (response.status === 404) {
          setIsExistingUser(false);
          setUserDetails({ id: '', username: '', phone, email: '' });
          setErrors({});
          setSubmitError(null);
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch user details');

        const result = await response.json();
        if (result.success && result.data) {
          const parsed = parseBirthday(result.data.birthday || '');
          setBirthMonth(parsed.month);
          setBirthDay(parsed.day);
          setUserDetails({
            id: result.data.id,
            username: result.data.username,
            phone: result.data.phone,
            email: result.data.email || '',
            birthday: result.data.birthday || '',
          });
          setIsExistingUser(true);
        } else {
          setIsExistingUser(false);
        }
      } catch (_error) {
        setSubmitError('Error fetching user details.');
      } finally {
        setIsLoading(false);
      }
    }, 450),
    [setUserDetails]
  );

  useEffect(() => {
    // A record picked from the list is already complete — don't re-fetch it.
    if (userDetails.phone.length === 11 && appliedPhoneRef.current !== userDetails.phone) {
      fetchUserDetails(userDetails.phone);
    }
    return () => fetchUserDetails.cancel();
  }, [userDetails.phone, fetchUserDetails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserDetails({ ...userDetails, [name]: value });

    if (name === 'phone' || name === 'username') {
      appliedPhoneRef.current = null;
      runSearch(value, name);
      if (value.trim().length < 2) {
        setMatches([]);
        setSearchField(null);
      }
    }

    if (name === 'email' && value.includes('@')) {
      const [local, domainPart] = value.split('@');
      if (domainPart !== undefined) {
        setEmailSuggestions(
          commonDomains.filter((d) => d.startsWith(domainPart)).map((d) => `${local}@${d}`)
        );
      }
    } else if (name === 'email') {
      setEmailSuggestions([]);
    }

    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]:
        name === 'phone' && !/^0\d{10}$/.test(value)
          ? 'Phone must be 11 digits and start with 0'
          : name === 'username' && value.length < 3
          ? 'Username must be at least 3 characters'
          : name === 'email' && value && !/\S+@\S+\.\S+/.test(value)
          ? 'Invalid email format'
          : undefined,
    }));
  };

  const handleBirthdayChange = (newMonth: string, newDay: string) => {
    if (newMonth && newDay) {
      const mm = newMonth.padStart(2, '0');
      const dd = newDay.padStart(2, '0');
      setUserDetails({ ...userDetails, birthday: `2000-${mm}-${dd}` });
    } else {
      setUserDetails({ ...userDetails, birthday: '' });
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (errors.username || errors.phone || errors.email) {
      setSubmitError('Please fix the highlighted errors before proceeding.');
      return;
    }
    if (!userDetails.username || !userDetails.phone) {
      setSubmitError('Username and phone are required.');
      return;
    }

    setIsLoading(true);
    try {
      const url = isExistingUser
        ? `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/phone?phone=${userDetails.phone}`
        : `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users`;
      const method = isExistingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDetails),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || 'Failed to process user');
      }

      onNext();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Every result shows the phone, so identically-named customers stay distinct. */
  const renderPicker = (field: 'phone' | 'username') => {
    if (searchField !== field || matches.length === 0) return null;

    return (
      <ul className="checkout-picker" role="listbox" aria-label="Matching customers">
        {matches.map((customer) => (
          <li key={customer.id} role="option" aria-selected={false}>
            <button type="button" className="checkout-picker-row" onClick={() => applyCustomer(customer)}>
              <span className="checkout-picker-name">{(customer.username || 'Unnamed').trim()}</span>
              <span className="checkout-picker-meta">
                {customer.phone} · {customer.visits} visit{customer.visits === 1 ? '' : 's'} ·{' '}
                {relativeVisit(customer.lastVisit)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  const showRecent = recent.length > 0 && !userDetails.phone && !userDetails.username;

  return (
    <div className="checkout-panel">
      <h2>Player Details</h2>
      {isExistingUser && <p className="checkout-success">Welcome back, {userDetails.username}. We found your profile.</p>}

      {showRecent && (
        <div className="checkout-recent">
          <p className="checkout-recent-label">Recent players — tap to fill</p>
          <div className="checkout-chips">
            {recent.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className="checkout-chip"
                onClick={() => applyCustomer(customer)}
              >
                <span className="checkout-chip-name">{(customer.username || 'Unnamed').trim()}</span>
                <span className="checkout-chip-meta">{customer.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="checkout-field-grid">
        <div className="checkout-field">
          <label>Phone</label>
          <input
            className="checkout-input"
            type="tel"
            name="phone"
            placeholder="08000000000"
            autoComplete="off"
            value={userDetails.phone}
            onChange={handleChange}
          />
          {renderPicker('phone')}
          {errors.phone && <p className="checkout-error">{errors.phone}</p>}
        </div>

        <div className="checkout-field">
          <label>Username</label>
          <input
            className="checkout-input"
            type="text"
            name="username"
            placeholder="Search or enter player name"
            autoComplete="off"
            value={userDetails.username}
            onChange={handleChange}
          />
          {renderPicker('username')}
          {!matches.length && searchField === 'username' && !isSearching && userDetails.username.trim().length >= 2 && (
            <p className="checkout-hint">No match — this will create a new player.</p>
          )}
          {errors.username && <p className="checkout-error">{errors.username}</p>}
        </div>

        <div className="checkout-field">
          <label>Email (optional)</label>
          <input
            className="checkout-input"
            type="email"
            name="email"
            placeholder="name@email.com"
            value={userDetails.email || ''}
            onChange={handleChange}
          />
          {emailSuggestions.length > 0 && (
            <ul className="checkout-suggestions">
              {emailSuggestions.map((suggestion) => (
                <li
                  className="checkout-suggestion"
                  key={suggestion}
                  onClick={() => {
                    setUserDetails({ ...userDetails, email: suggestion });
                    setEmailSuggestions([]);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                    setSubmitError(null);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
          {errors.email && <p className="checkout-error">{errors.email}</p>}
        </div>

        <div className="checkout-field">
          <label>Birthday (optional) 🎂</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="checkout-input"
              style={{ flex: 2 }}
              value={birthMonth}
              onChange={(e) => {
                const m = e.target.value;
                const maxDay = m ? daysInMonth(Number(m)) : 31;
                const clampedDay = birthDay && Number(birthDay) > maxDay ? '' : birthDay;
                setBirthMonth(m);
                setBirthDay(clampedDay);
                handleBirthdayChange(m, clampedDay);
              }}
            >
              <option value="">Month</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={String(i + 1)}>{name}</option>
              ))}
            </select>
            <select
              className="checkout-input"
              style={{ flex: 1 }}
              value={birthDay}
              disabled={!birthMonth}
              onChange={(e) => {
                const d = e.target.value;
                setBirthDay(d);
                handleBirthdayChange(birthMonth, d);
              }}
            >
              <option value="">Day</option>
              {Array.from({ length: birthMonth ? daysInMonth(Number(birthMonth)) : 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#83a6bc', marginTop: 4 }}>
            We'll send you a birthday treat every year 🎁
          </p>
        </div>
      </div>

      {submitError && <p className="checkout-error">{submitError}</p>}

      <div className="checkout-actions">
        <button
          className="checkout-btn checkout-btn-primary"
          onClick={handleSubmit}
          disabled={!userDetails.username || !userDetails.phone || isLoading}
        >
          {isLoading ? 'Processing...' : isExistingUser ? 'Update Profile' : 'Create Profile'}
        </button>
        {(userDetails.username || userDetails.phone) && (
          <button type="button" className="checkout-btn" onClick={clearForm} disabled={isLoading}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default UserDetails;
