import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Ancien et nouveau mot de passe requis' },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = user.id;

    const rows = await query(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const dbUser = rows[0];
    const isValid = await bcrypt.compare(oldPassword, dbUser.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Ancien mot de passe incorrect' },
        { status: 401 }
      );
    }

    if (newPassword.length < 12 || newPassword.length > 256) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir entre 12 et 256 caractères' }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    return NextResponse.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
