import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { CleverTodo } from '../target/types/clever_todo';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMint,
    createAccount,
    mintTo,
    getAccount,
} from '@solana/spl-token';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { assert } from 'chai';

describe('clever_todo', () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.CleverTodo as Program<CleverTodo>;

    const authority = anchor.web3.Keypair.generate();

    const connection = anchor.getProvider().connection;

    const airdrop = async () => {
        const signature = await connection.requestAirdrop(
            authority.publicKey,
            anchor.web3.LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(signature);
    };

    const [profilePda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            new TextEncoder().encode('USER_STATE'),
            authority.publicKey.toBuffer(),
        ],
        program.programId
    );

    let userRepo: anchor.web3.PublicKey;

    // Use Mainnet-fork for testing
    const commitment: anchor.web3.Commitment = 'processed'; // processed, confirmed, finalized

    const options = anchor.AnchorProvider.defaultOptions();
    const wallet = NodeWallet.local();
    const provider = new anchor.AnchorProvider(connection, wallet, options);

    anchor.setProvider(provider);

    let mintA = null as anchor.web3.PublicKey;
    let mintB = null as anchor.web3.PublicKey;
    let initializerTokenAccountA = null as anchor.web3.PublicKey;
    let initializerTokenAccountB = null as anchor.web3.PublicKey;
    let takerTokenAccountA = null as anchor.web3.PublicKey;
    let takerTokenAccountB = null as anchor.web3.PublicKey;

    const takerAmount = 1000;
    const initializerAmount = 500;

    // Main Roles
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const initializer = anchor.web3.Keypair.generate();
    const taker = anchor.web3.Keypair.generate();

    // Determined Seeds
    const stateSeed = 'state';
    const authoritySeed = 'authority';

    // Random Seed
    const randomSeed: anchor.BN = new anchor.BN(
        Math.floor(Math.random() * 100000000)
    );

    // Derive PDAs: escrowStateKey, vaultKey, vaultAuthorityKey
    const escrowStateKey = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode(stateSeed)),
            randomSeed.toArrayLike(Buffer, 'le', 8),
        ],
        program.programId
    )[0];

    const vaultAuthorityKey = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(authoritySeed, 'utf-8')],
        program.programId
    )[0];
    let vaultKey = null as anchor.web3.PublicKey;

    it('Initialize program state', async () => {
        // 1. Airdrop 1 SOL to payer
        const signature = await provider.connection.requestAirdrop(
            payer.publicKey,
            1000000000
        );
        const latestBlockhash = await connection.getLatestBlockhash();
        await provider.connection.confirmTransaction(
            {
                signature,
                ...latestBlockhash,
            },
            commitment
        );

        // 2. Fund main roles: initializer and taker
        const fundingTxMessageV0 = new anchor.web3.TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: initializer.publicKey,
                    lamports: 100000000,
                }),
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: taker.publicKey,
                    lamports: 100000000,
                }),
            ],
        }).compileToV0Message();
        const fundingTx = new anchor.web3.VersionedTransaction(
            fundingTxMessageV0
        );
        fundingTx.sign([payer]);

        // console.log(Buffer.from(fundingTx.serialize()).toString("base64"));
        const result = await connection.sendRawTransaction(
            fundingTx.serialize()
        );
        console.log(
            `https://solana.fm/tx/${result}?cluster=http%253A%252F%252Flocalhost%253A8899%252F`
        );

        // 3. Create dummy token mints: mintA and mintB
        mintA = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            null,
            0
        );
        mintB = await createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            null,
            0
        );

        // 4. Create token accounts for dummy token mints and both main roles
        initializerTokenAccountA = await createAccount(
            connection,
            initializer,
            mintA,
            initializer.publicKey
        );
        initializerTokenAccountB = await createAccount(
            connection,
            initializer,
            mintB,
            initializer.publicKey
        );
        takerTokenAccountA = await createAccount(
            connection,
            taker,
            mintA,
            taker.publicKey
        );
        takerTokenAccountB = await createAccount(
            connection,
            taker,
            mintB,
            taker.publicKey
        );

        // 5. Mint dummy tokens to initializerTokenAccountA and takerTokenAccountB
        await mintTo(
            connection,
            initializer,
            mintA,
            initializerTokenAccountA,
            mintAuthority,
            initializerAmount
        );
        await mintTo(
            connection,
            taker,
            mintB,
            takerTokenAccountB,
            mintAuthority,
            takerAmount
        );

        const fetchedInitializerTokenAccountA = await getAccount(
            connection,
            initializerTokenAccountA
        );
        const fetchedTakerTokenAccountB = await getAccount(
            connection,
            takerTokenAccountB
        );

        assert.ok(
            Number(fetchedInitializerTokenAccountA.amount) == initializerAmount
        );
        assert.ok(Number(fetchedTakerTokenAccountB.amount) == takerAmount);
    });

    it('Is initialized!', async () => {
        await airdrop();

        await program.methods
            .initializeUser('new github')
            .accounts({
                authority: authority.publicKey,
                userProfile: profilePda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
    });

    it('Add repo', async () => {
        const account = await program.account.userProfile.fetch(profilePda);

        const [repoPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('REPO_STATE'),
                authority.publicKey.toBuffer(),
                new Uint8Array([account.lastRepo]),
            ],
            program.programId
        );

        await program.methods
            .addRepo('Test repo')
            .accounts({
                authority: authority.publicKey,
                userProfile: profilePda,
                systemProgram: anchor.web3.SystemProgram.programId,
                repoAccount: repoPda,
            })
            .signers([authority])
            .rpc();

        userRepo = repoPda;
    });

    it('Add todo', async () => {
        const repo = await program.account.userRepos.fetch(userRepo);

        const [ticketPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('TODO_STATE'),
                authority.publicKey.toBuffer(),
                new Uint8Array([repo.lastTodo]),
            ],
            program.programId
        );

        const _vaultKey = anchor.web3.PublicKey.findProgramAddressSync(
            [
                vaultAuthorityKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                mintA.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        )[0];
        vaultKey = _vaultKey;

        await program.methods
            .addTodo(
                0,
                randomSeed,
                new anchor.BN(initializerAmount),
                new anchor.BN(takerAmount),
                'test',
            )
            .accounts({
                authority: authority.publicKey,
                repoAccount: userRepo,
                systemProgram: anchor.web3.SystemProgram.programId,
                todoAccount: ticketPda,
                vaultAuthority: vaultAuthorityKey,
                vault: vaultKey,
                mint: mintA,
                initializerDepositTokenAccount: initializerTokenAccountA,
                initializerReceiveTokenAccount: initializerTokenAccountB,
                escrowState: escrowStateKey,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        const ticket = await program.account.userTickets.fetch(ticketPda);
        console.log(ticket);
    });
});
