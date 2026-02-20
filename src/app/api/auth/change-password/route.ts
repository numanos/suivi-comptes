import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Ancien et nouveau mot de passe requis' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const authCookie = cookieStore.get('auth');
    if (!authCookie) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = authCookie.value;

    const rows = await query(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Ancien mot de passe incorrect' },
        { status: 401 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

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
