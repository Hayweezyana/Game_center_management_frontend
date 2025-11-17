import React, { useState, useEffect, useCallback } from 'react';
import { debounce, set } from 'lodash';
import { v4 as uuidv4 } from 'uuid';


interface UserDetailsProps {
  userDetails: {  id?: string; username: string; phone: string; email?: string };
  setUserDetails: (details: { id?: string; username: string; phone: string; email?: string }) => void;
  onNext: () => void;
}

const UserDetails: React.FC<UserDetailsProps> = ({ userDetails, setUserDetails, onNext }) => {
  const [errors, setErrors] = useState<{ id?: String; username?: string; phone?: string; email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);

  const [phoneSuggestions, setPhoneSuggestions] = useState<string[]>([]);
  const commonDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

  const fetchPhoneSuggestions = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 4) return; // only search after 4 digits

      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/phone-suggestions?phone=${phone}`
        );
        if (!response.ok) return;

        const result = await response.json();
        if (result.success) {
          setPhoneSuggestions(result.data); // array of phone numbers
        }
      } catch (err) {
        console.error("Error fetching phone suggestions:", err);
      }
    }, 400),
    []
  );

  // Fetch user details when phone number changes (debounced)
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
        console.log("Fetch Result:", result);

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
      } catch (error) {
        setSubmitError('Error fetching user details.');
      } finally {
        setIsLoading(false);
      }
    }, 500), // 500ms debounce
    [setUserDetails]
  );

  useEffect(() => {
    if (userDetails.phone.length === 11) {
      fetchUserDetails(userDetails.phone);
    }
    return () => fetchUserDetails.cancel();
  }, [userDetails.phone]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserDetails({ ...userDetails, [name]: value });

    if (value.includes("@")) {
      const [local, domainPart] = value.split("@");
      if (domainPart !== undefined) {
        setEmailSuggestions(
          commonDomains
            .filter((d) => d.startsWith(domainPart))
            .map((d) => `${local}@${d}`)
        );
      }
    } else {
      setEmailSuggestions([]);
    }

    // Validate input
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

  // Handle form submission
  const handleSubmit = async () => {
    setSubmitError(null);
    if (errors.username || errors.phone || errors.email) {
      setSubmitError("Please fix the highlighted errors before proceeding.");
      return;
    }

    if (!userDetails.username || !userDetails.phone) {
      setSubmitError("Username and phone are required.");
      return;
    }

    setIsLoading(true);
    try {
      const url = isExistingUser
        ? `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/phone?=${userDetails.phone}`
        : `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users`;
      const method = isExistingUser ? 'PUT' : 'POST';

      const payload = isExistingUser
        ? userDetails
        : { ...userDetails, phone: userDetails.phone || uuidv4() };

      if (!isExistingUser && !userDetails.phone) {
        setUserDetails({ ...userDetails, phone: payload.phone });
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('API Response:', result);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process user');
      }

      onNext(); // Proceed to the next step
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>User Details</h2>
      {isExistingUser && <p style={{ color: 'green' }}>Welcome back {userDetails.username}! Updating your existing profile.</p>}
      <div>
        <label>Phone:</label>
        <input
          type="tel"
          name="phone"
          value={userDetails.phone}
          onChange={(e) => {
            handleChange(e);
            fetchPhoneSuggestions(e.target.value);
          }}
        />
        {phoneSuggestions.length > 0 && (
          <ul style={{ border: "1px solid #ccc", cursor: "pointer" }}>
            {phoneSuggestions.map((num) => (
              <li key={num} onClick={() => {
                setUserDetails({ ...userDetails, phone: num });
                setPhoneSuggestions([]); // clear suggestions
                setErrors((prev) => ({ ...prev, phone: undefined })); // clear error
                setSubmitError(null); // clear global error if any
              }}>
                {num}
              </li>
            ))}
          </ul>
        )}
        {errors.phone && <p style={{ color: 'red' }}>{errors.phone}</p>}
      </div>
      <div>
        <label>Username:</label>
        <input type="text" name="username" value={userDetails.username} onChange={handleChange} />
        {errors.username && <p style={{ color: 'red' }}>{errors.username}</p>}
      </div>
      <div>
        <label>Email (optional):</label>
        <input type="email" name="email" value={userDetails.email || ''} onChange={handleChange} />
        {emailSuggestions.length > 0 && (
          <ul style={{ border: "1px solid #ccc", cursor: "pointer" }}>
            {emailSuggestions.map((s) => (
              <li key={s} onClick={() => {
                setUserDetails({ ...userDetails, email: s });
                setEmailSuggestions([]); // clear suggestions
                setErrors((prev) => ({ ...prev, email: undefined })); // clear error
                setSubmitError(null);
              }}>
                {s}
              </li>
            ))}
          </ul>
        )}
        {errors.email && <p style={{ color: 'red' }}>{errors.email}</p>}
      </div>
      {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      <button onClick={handleSubmit} disabled={!userDetails.username || !userDetails.phone || isLoading}>
        {isLoading ? 'Processing...' : isExistingUser ? 'Update Profile' : 'Create Profile'}
      </button>
    </div>
  );
};

export default UserDetails;