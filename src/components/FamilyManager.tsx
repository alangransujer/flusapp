import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

import { Family } from '../../types';

interface FamilyManagerProps {
    onSelectFamily: (family: Family) => void;
}

export default function FamilyManager({ onSelectFamily }: FamilyManagerProps) {
    const { user } = useAuth();
    // const [families, setFamilies] = useState<Family[]>([]); // Removed global list
    const [newFamilyName, setNewFamilyName] = useState('');
    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [foundFamily, setFoundFamily] = useState<Family | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Generate a simple 4-char code
    const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

    const searchFamilyByCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFoundFamily(null);
        setSuccessMsg(null);

        if (joinCodeInput.length !== 4) {
            setError("Code must be 4 characters.");
            return;
        }

        setLoading(true);
        // Note: This relies on the 'join_code' column existing in Supabase 'families' table.
        // If it doesn't exist, this query will fail or return nothing depending on schema.
        // Assuming the schema matches the 'Family' interface update.
        const { data, error } = await supabase
            .from('families')
            .select('*')
            .eq('join_code', joinCodeInput)
            .single();

        if (error || !data) {
            setError("Family not found or invalid code.");
        } else {
            setFoundFamily({
                id: data.id,
                name: data.name,
                joinCode: data.join_code,
                createdDate: data.created_at
            });
        }
        setLoading(false);
    };

    const createFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!newFamilyName.trim()) return;

        const code = generateCode();

        const { data, error } = await supabase.from('families').insert([
            { name: newFamilyName, created_by: user.id, join_code: code },
        ]).select().single();

        if (error) {
            setError(error.message);
        } else if (data) {
            setSuccessMsg(`Family "${data.name}" created! Code: ${data.join_code}`);
            setNewFamilyName('');
            // Auto-select the new family
            onSelectFamily({
                id: data.id,
                name: data.name,
                joinCode: data.join_code,
                createdDate: data.created_at
            });
        }
    };

    return (
        <div className="p-6 border rounded-xl shadow-sm bg-white dark:bg-gray-800 mt-4 transition-colors">
            <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Family Access</h3>

            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
            {successMsg && <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">{successMsg}</div>}

            <div className="grid md:grid-cols-2 gap-8">
                {/* Section 1: Join / Access */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Access with Code</h4>
                    <form onSubmit={searchFamilyByCode} className="flex gap-2">
                        <input
                            type="text"
                            maxLength={4}
                            placeholder="Entrar 4-char code"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            className="border p-2 rounded w-full bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 uppercase font-mono tracking-widest"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? '...' : 'Find'}
                        </button>
                    </form>

                    {foundFamily && (
                        <div className="p-4 border border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg flex justify-between items-center animate-in fade-in">
                            <div>
                                <p className="font-bold text-green-800 dark:text-green-300">{foundFamily.name}</p>
                                <p className="text-xs text-green-600 dark:text-green-400">Created: {new Date(foundFamily.createdDate).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => onSelectFamily(foundFamily)}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-green-700"
                            >
                                Enter
                            </button>
                        </div>
                    )}
                </div>

                {/* Section 2: Create New */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-8">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Create New Family</h4>
                    <form onSubmit={createFamily} className="flex flex-col gap-2">
                        <input
                            type="text"
                            placeholder="Family Name"
                            value={newFamilyName}
                            onChange={(e) => setNewFamilyName(e.target.value)}
                            className="border p-2 rounded bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 w-full"
                        >
                            Create & Generate Code
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
