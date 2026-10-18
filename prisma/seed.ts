import "dotenv/config";
import { InvoiceStatus, type Client, type User } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { hash } from "bcrypt";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

// Utilisateur enrichi du mot de passe en clair, affiché après le seed
type SeedUser = User & { plainPass: string };

// Dossiers source des avatars
const USERS_AVATARS_DIR = path.join(process.cwd(), "public/uploads/avatars/users");
const CLIENTS_AVATARS_DIR = path.join(process.cwd(), "public/uploads/avatars/clients");

// Liste les avatars disponibles, avec "default.svg" en secours
function getAvatarFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return ["default.svg"];
	}

	const files = fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name);

	return files.length > 0 ? files : ["default.svg"];
}

// Génère un email unique pour respecter la contrainte @unique
function generateUniqueEmail(usedEmails: Set<string>): string {
	let email = faker.internet.email().toLowerCase();
	while (usedEmails.has(email)) {
		email = faker.internet.email().toLowerCase();
	}
	usedEmails.add(email);
	return email;
}

async function main() {
	console.log("🌱 Seeding...");

	// Vide les tables dans l'ordre des clés étrangères, de façon atomique
	await prisma.$transaction([prisma.invoice.deleteMany(), prisma.client.deleteMany(), prisma.user.deleteMany()]);

	// Avatars utilisateurs disponibles
	const usersAvatarsFiles = getAvatarFiles(USERS_AVATARS_DIR); //[profile1.webp, profile2.webp....]

	// Crée 5 utilisateurs avec un mot de passe hashé
	const users: SeedUser[] = [];
	const usedEmails = new Set<string>();
	for (let i = 0; i < 5; i++) {
		const plainPass = faker.internet.password({ length: 10 });
		const hashedPass = await hash(plainPass, 10);
		const user = await prisma.user.create({
			data: {
				email: generateUniqueEmail(usedEmails),
				password: hashedPass,
				name: faker.person.fullName(),
				avatarUrl: "/uploads/avatars/users/" + faker.helpers.arrayElement(usersAvatarsFiles),
			},
		});
		users.push({ ...user, plainPass });
	}

	// Affiche les identifiants pour pouvoir tester la connexion
	users.forEach((user) => console.log(user.email, "-", user.plainPass));

	// Avatars clients disponibles
	const clientsAvatarsFiles = getAvatarFiles(CLIENTS_AVATARS_DIR); //[avatar1.webp, avatar2.webp....]

	// Crée les clients puis les factures de chaque utilisateur
	for (const user of users) {
		// 5 à 7 clients par utilisateur
		const clients: Client[] = [];
		const clientsCount = faker.number.int({ min: 5, max: 7 });
		for (let i = 0; i < clientsCount; i++) {
			const client = await prisma.client.create({
				data: {
					name: faker.company.name(),
					email: faker.internet.email().toLowerCase(),
					userId: user.id,
					avatarUrl: "/uploads/avatars/clients/" + faker.helpers.arrayElement(clientsAvatarsFiles),
				},
			});
			clients.push(client);
		}
		// Factures réparties sur les 2 dernières années
		const now = new Date();
		const twoYearsAgo = new Date(now);
		twoYearsAgo.setFullYear(now.getFullYear() - 2);
		let invoiceNumber = 1; // numérotation propre à chaque utilisateur
		const invoicesCount = faker.number.int({ min: 10, max: 40 });
		for (let i = 0; i < invoicesCount; i++) {
			const client = faker.helpers.arrayElement(clients);
			// Date de création aléatoire sur les 2 dernières années
			const createdAt = faker.date.between({ from: twoYearsAgo, to: now });
			// Échéance entre la création et 60 jours plus tard
			const dueDate = faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000) });
			await prisma.invoice.create({
				data: {
					// Numéro unique par utilisateur (@@unique([userId, number]))
					number: invoiceNumber++,
					amount: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
					// Statut aléatoire pour varier les données de test
					status: faker.helpers.arrayElement([
						InvoiceStatus.DRAFT,
						InvoiceStatus.OVERDUE,
						InvoiceStatus.SENT,
						InvoiceStatus.PAID,
					]),
					createdAt,
					dueDate,
					userId: user.id,
					clientId: client.id,
				},
			});
		}
	}

	console.log("✅ Seed terminé");
}

main()
	.then(() => console.log("✅ Done"))
	.catch((err) => {
		// Affiche l'erreur et renvoie un code de sortie non nul
		console.error("❌ Seed échoué", err);
		// process.exitCode plutôt que process.exit() pour laisser le finally se déconnecter
		process.exitCode = 1;
	})
	.finally(async () => {
		// Ferme proprement la connexion Prisma
		await prisma.$disconnect();
	});
