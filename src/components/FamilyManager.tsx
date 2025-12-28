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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFamilies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('families')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching families:', error);
            setError(error.message);
        } else {
            setFamilies(data?.map(f => ({
                id: f.id,
                name: f.name,
                createdDate: f.created_at,
                joinCode: 'N/A' // Legacy field
            })) || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (user) {
            fetchFamilies();
        }
    }, [user]);

    const createFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!newFamilyName.trim()) return;

        const { error } = await supabase.from('families').insert([
            { name: newFamilyName, created_by: user.id },
        ]);

        if (error) {
            setError(error.message);
        } else {
            setNewFamilyName('');
            fetchFamilies();
        }
    };

    if (loading && !families.length) return <p>Loading families...</p>;

    return (
        <div className="p-4 border rounded shadow-sm bg-white mt-4">
            <h3 className="text-xl font-semibold mb-4">Your Families</h3>
            {error && <p className="text-red-500 mb-2">{error}</p>}

            <form onSubmit={createFamily} className="flex gap-2 mb-4">
                <input
                    type="text"
                    placeholder="New Family Name"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    className="border p-2 rounded flex-grow"
                />
                <button
                    type="submit"
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                    Create
                </button>
            </form>

            {families.length === 0 ? (
                <p className="text-gray-500">No families found. Create one above!</p>
            ) : (
                <ul className="space-y-2">
                    {families.map((family) => (
                        <li key={family.id} className="border-b last:border-0 pb-2 flex justify-between items-center">
                            <div>
                                <span className="font-medium">{family.name}</span>
                                <span className="text-xs text-gray-400 ml-2">
                                    {new Date(family.created_at || family.createdDate).toLocaleDateString()}
                                </span>
                            </div>
                            <button
                                onClick={() => onSelectFamily(family)}
                                className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                            >
                                Select
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
