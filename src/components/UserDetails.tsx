import React, { useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash';
import './CheckoutExperience.css';

interface UserDetailsProps {
  userDetails: { id?: string; username: string; phone: string; email?: string };
  setUserDetails: (details: { id?: string; username: string; phone: string; email?: string }) => void;
  onNext: () => void;
}

const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

const UserDetails: React.FC<UserDetailsProps> = ({ userDetails, setUserDetails, onNext }) => {
  const [errors, setErrors] = useState<{ username?: string; phone?: string; email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [phoneSuggestions, setPhoneSuggestions] = useState<string[]>([]);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

  const fetchPhoneSuggestions = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 4) return;
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/phone-suggestions?phone=${phone}`
        );
        if (!response.ok) return;
        const result = await response.json();
        if (result.success) {
          setPhoneSuggestions(result.data);
        }
      } catch (err) {
        console.error('Error fetching phone suggestions:', err);
      }
    }, 350),
    []
  );

  const fetchUserDetails = useCallback(
    debounce(async (phone: string) => {
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
          setUserDetails({
            id: result.data.id,
            username: result.data.username,
            phone: result.data.phone,
            email: result.data.email || '',
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
    if (userDetails.phone.length === 11) {
      fetchUserDetails(userDetails.phone);
    }
    return () => fetchUserDetails.cancel();
  }, [userDetails.phone, fetchUserDetails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserDetails({ ...userDetails, [name]: value });

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

  return (
    <div className="checkout-panel">
      <h2>Player Details</h2>
      {isExistingUser && <p className="checkout-success">Welcome back, {userDetails.username}. We found your profile.</p>}

      <div className="checkout-field-grid">
        <div className="checkout-field">
          <label>Phone</label>
          <input
            className="checkout-input"
            type="tel"
            name="phone"
            placeholder="08000000000"
            value={userDetails.phone}
            onChange={(e) => {
              handleChange(e);
              fetchPhoneSuggestions(e.target.value);
            }}
          />
          {phoneSuggestions.length > 0 && (
            <ul className="checkout-suggestions">
              {phoneSuggestions.map((num) => (
                <li
                  className="checkout-suggestion"
                  key={num}
                  onClick={() => {
                    setUserDetails({ ...userDetails, phone: num });
                    setPhoneSuggestions([]);
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                    setSubmitError(null);
                  }}
                >
                  {num}
                </li>
              ))}
            </ul>
          )}
          {errors.phone && <p className="checkout-error">{errors.phone}</p>}
        </div>

        <div className="checkout-field">
          <label>Username</label>
          <input
            className="checkout-input"
            type="text"
            name="username"
            placeholder="Enter player name"
            value={userDetails.username}
            onChange={handleChange}
          />
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
      </div>
    </div>
  );
};

export default UserDetails;
