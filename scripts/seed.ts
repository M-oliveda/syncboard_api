#!/usr/bin/env -S tsx
import "dotenv/config";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "@/config/db.js";
import { logger } from "@/utils/logger.js";
import { computeOrderBetween } from "@/utils/reorder.js";
import { UserModel } from "@/models/user.model.js";
import { WorkspaceModel } from "@/models/workspace.model.js";
import { BoardModel } from "@/models/board.model.js";
import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { env } from "@/config/env.js";

const PASSWORD_COST = 12;

type SeedUser = { email: string; password: string; _id?: string };

const seedUsers: SeedUser[] = [
    { email: "ada.admin@syncboard.dev", password: "SeedAda1!" },
    { email: "sam.member@syncboard.dev", password: "SeedSam2!" },
    { email: "riley.solo@syncboard.dev", password: "SeedRiley3!" },
];

const seedWorkspaceNames = ["Acme Engineering", "Riley Lab"];

const abortIfProduction = () => {
    if (env.NODE_ENV === "production") {
        logger.error("Refusing to run seeder in production NODE_ENV");
        process.exit(1);
    }
};

const clearPreviousSeed = async (userEmails: string[], workspaceNames: string[]) => {
    // Find users created by a previous seed run
    const existingUsers = await UserModel.find({ email: { $in: userEmails } });
    const existingUserIds = existingUsers.map((u) => u._id);

    // Delete workspaces that match the seed names
    const workspaces = await WorkspaceModel.find({
        name: { $in: workspaceNames },
    }).select("_id");
    const workspaceIds = workspaces.map((w) => w._id);

    // Delete descendant documents
    const boards = await BoardModel.find({ workspaceId: { $in: workspaceIds } }).select(
        "_id",
    );
    const boardIds = boards.map((b) => b._id);
    const lists = await ListModel.find({ boardId: { $in: boardIds } }).select("_id");
    const listIds = lists.map((l) => l._id);

    if (listIds.length > 0) {
        await CardModel.deleteMany({ listId: { $in: listIds } });
    }
    if (boardIds.length > 0) {
        await ListModel.deleteMany({ boardId: { $in: boardIds } });
    }
    if (workspaceIds.length > 0) {
        await BoardModel.deleteMany({ workspaceId: { $in: workspaceIds } });
    }
    if (workspaceIds.length > 0) {
        await WorkspaceModel.deleteMany({ _id: { $in: workspaceIds } });
    }

    // Remove seeded users from any remaining memberships and card assignees
    if (existingUserIds.length > 0) {
        await WorkspaceModel.updateMany(
            { "members.userId": { $in: existingUserIds } },
            { $pull: { members: { userId: { $in: existingUserIds } } } },
        );
        await CardModel.updateMany(
            { assignees: { $in: existingUserIds } },
            { $pull: { assignees: { $in: existingUserIds } } },
        );
        await UserModel.deleteMany({ _id: { $in: existingUserIds } });
    }
};

const createOrderedLists = async (boardId: string, titles: string[]) => {
    let lastOrder: number | null = null;
    const created: Array<{ id: string; order: number; title: string }> = [];
    for (const title of titles) {
        const order = computeOrderBetween(lastOrder, null);
        const list = await ListModel.create({ boardId, title, order });
        created.push({ id: list._id.toString(), order, title });
        lastOrder = order;
    }
    return created;
};

const createCardsForList = async (
    listId: string,
    assigneeIds: string[],
    samples: Array<{
        title: string;
        description?: string;
        labels?: string[];
        checklist?: { text: string; done?: boolean }[];
        assignees?: string[];
    }>,
) => {
    let lastOrder: number | null = null;
    const created: Array<{ id: string; title: string }> = [];
    for (const s of samples) {
        const order = computeOrderBetween(lastOrder, null);
        const card = await CardModel.create({
            listId,
            title: s.title,
            description: s.description ?? "",
            order,
            assignees: s.assignees ?? assigneeIds.map((id) => new Types.ObjectId(id)),
            labels: s.labels ?? [],
            checklist: s.checklist ?? [],
        });
        created.push({ id: card._id.toString(), title: card.title });
        lastOrder = order;
    }
    return created;
};

const main = async (): Promise<void> => {
    abortIfProduction();
    await connectDb();
    try {
        logger.info("Starting seed: clearing previous seed data (seed-only)");
        await clearPreviousSeed(
            seedUsers.map((u) => u.email),
            seedWorkspaceNames,
        );

        logger.info("Creating users");
        const createdUsers: SeedUser[] = [];
        for (const u of seedUsers) {
            const passwordHash = await bcrypt.hash(u.password, PASSWORD_COST);
            const user = await UserModel.create({ email: u.email, passwordHash });
            createdUsers.push({ ...u, _id: user._id.toString() });
        }

        const ada = createdUsers.find((u) => u.email.startsWith("ada"));
        const sam = createdUsers.find((u) => u.email.startsWith("sam"));
        const riley = createdUsers.find((u) => u.email.startsWith("riley"));

        // Create Acme Engineering workspace with Ada (Admin) and Sam (Member)
        logger.info("Creating Acme Engineering workspace");
        const acme = await WorkspaceModel.create({
            name: "Acme Engineering",
            members: [
                { userId: new Types.ObjectId(ada!._id!), role: "Admin" },
                { userId: new Types.ObjectId(sam!._id!), role: "Member" },
            ],
        });

        // Create Riley Lab workspace with Riley (Admin)
        logger.info("Creating Riley Lab workspace");
        const rlab = await WorkspaceModel.create({
            name: "Riley Lab",
            members: [{ userId: new Types.ObjectId(riley!._id!), role: "Admin" }],
        });

        // Boards and lists
        logger.info("Creating boards, lists and cards for Acme");
        const product = await BoardModel.create({
            workspaceId: acme._id,
            title: "Product Roadmap",
        });
        const sprint = await BoardModel.create({
            workspaceId: acme._id,
            title: "Sprint 14",
        });
        const personal = await BoardModel.create({
            workspaceId: rlab._id,
            title: "Personal Tasks",
        });

        const listTitles = ["To Do", "In Progress", "Done"];

        // Product Roadmap
        const productLists = await createOrderedLists(
            product._id.toString(),
            listTitles,
        );
        // Sprint
        const sprintLists = await createOrderedLists(sprint._id.toString(), listTitles);
        // Personal
        const personalLists = await createOrderedLists(
            personal._id.toString(),
            listTitles,
        );

        // Cards samples
        const samplesFull = [
            {
                title: "Write product spec",
                description:
                    "Draft the initial product spec and share with stakeholders.",
                labels: ["spec", "priority-high"],
                checklist: [{ text: "Outline", done: true }, { text: "Write draft" }],
            },
            {
                title: "Design review",
                description: "Collect feedback from design on the new flow.",
                labels: ["design"],
                checklist: [{ text: "Prepare mocks" }],
            },
        ];

        const samplesMinimal = [
            { title: "Quick bugfix" },
            { title: "Refactor cleanup" },
        ];

        // Assign Ada and Sam to some Acme cards
        const assigneeIds = [ada!._id!, sam!._id!];

        // Populate product board lists
        for (const l of productLists) {
            await createCardsForList(l.id, assigneeIds, [
                ...samplesFull,
                ...samplesMinimal,
            ]);
        }

        // Populate sprint board lists
        for (const l of sprintLists) {
            await createCardsForList(l.id, assigneeIds, [
                ...samplesMinimal,
                ...samplesFull,
            ]);
        }

        // Populate personal board lists (Riley only)
        for (const l of personalLists) {
            await createCardsForList(l.id, [riley!._id!], [...samplesMinimal]);
        }

        logger.info("Seed complete — summary:");
        for (const u of createdUsers) {
            logger.info(`User: ${u.email}  Password: ${u.password}  ID: ${u._id}`);
        }
        logger.info(`Acme workspace ID: ${acme._id.toString()}`);
        logger.info(`Riley Lab workspace ID: ${rlab._id.toString()}`);
    } catch (err) {
        logger.error("Seeding failed", { error: err });
        process.exitCode = 1;
    } finally {
        await disconnectDb();
    }
};

main().catch((err) => {
    logger.error("Unhandled error in seeder", { error: err });
    process.exit(1);
});
