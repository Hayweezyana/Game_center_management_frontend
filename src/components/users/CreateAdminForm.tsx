import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './CreateAdminForm.css';

const CreateAdminForm: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [description, setDescription] = useState('');
  const [passwordShown, setPasswordShown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async () => {
    try {
      setIsCreating(true);
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      const Password = await password.length < 8
        ? Promise.reject(new Error('Password must be at least 8 characters long'))
        : password;
      const newPermissionUUID = uuidv4();

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/create`,
        {
          name,
          password: Password,
          description,
          slug,
          permissions: [newPermissionUUID],
        }
      );

      alert(response.data.message);
      setName('');
      setPassword('');
      setDescription('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Admin creation failed');
    } finally {
        setTimeout(() => {
      setIsCreating(false);
    }, 2000);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-6 text-center">Create New Admin</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black-700">Username</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Admin username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <input
              type={passwordShown ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
              placeholder="Password"
            />
            <span
              onClick={() => setPasswordShown(!passwordShown)}
            >
              {passwordShown ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="admin designation"
          />
        </div>

        <button
          onClick={handleCreateUser}
          disabled={isCreating}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          {isCreating ? 'Creating...' : 'Create Admin'}
        </button>
      </div>
    </div>
  );
};

export default CreateAdminForm;
