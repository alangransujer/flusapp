import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

import { Family } from '../../types';

interface FamilyManagerProps {
    onSelectFamily: (family: Family) => void;
}

export default function FamilyManager({ onSelectFamily }: FamilyManagerProps) {
    const { user } = useAuth();
    const [families, setFamilies] = useState<Family[]>([]);
    const [newFamilyName, setNewFamilyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchFamilies();
    }, []);

    const fetchFamilies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('families')
            .select('*');

        if (error) {
            setError(error.message);
        } else {
            setFamilies(data.map(f => ({
                id: f.id,
                name: f.name,
                createdDate: f.created_at,
                createdBy: f.created_by
            })));
        }
        setLoading(false);
    };

    const createFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!newFamilyName.trim()) return;

        const { data, error } = await supabase.from('families').insert([
            { name: newFamilyName, created_by: user.id },
        ]).select().single();

        if (error) {
            setError(error.message);
        } else if (data) {
            setSuccessMsg(`Family "${data.name}" created!`);
            setNewFamilyName('');
            fetchFamilies();
        }
    };

    return (
        <div className="p-6 border rounded-xl shadow-sm bg-white dark:bg-gray-800 mt-4 transition-colors">
            <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Family Access</h3>

            {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg flex justify-between items-center">
                {error}
                <button onClick={fetchFamilies} className="underline font-bold">Retry</button>
            </div>}
            {successMsg && <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">{successMsg}</div>}

            <div className="grid md:grid-cols-2 gap-8">
                {/* Section 1: Choose Family */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300">Choose Family</h4>
                        <button onClick={fetchFamilies} className="text-xs text-blue-600 hover:underline">Refresh</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {loading && <p className="text-sm text-gray-500 italic">Syncing with database...</p>}
                        {!loading && families.length === 0 && (
                            <div className="p-4 text-center border-2 border-dashed rounded-lg dark:border-gray-700">
                                <p className="text-sm text-gray-500">No families found on your account.</p>
                                <p className="text-xs text-gray-400 mt-1">If someone invited you, ensure you are using the same database.</p>
                            </div>
                        )}
                        {families.map(family => (
                            <div key={family.id} className="p-3 border rounded-lg flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition-colors">
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{family.name}</p>
                                    <p className="text-xs text-gray-500">Created: {new Date(family.createdDate).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => onSelectFamily(family)}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-blue-700"
                                >
                                    Select
                                </button>
                            </div>
                        ))}
                    </div>
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
                            Create Family
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
