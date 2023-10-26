import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { CleverTodo } from '../target/types/clever_todo';

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

    let userProfile: anchor.web3.PublicKey;
    let userRepo: anchor.web3.PublicKey;

    it('Is initialized!', async () => {
        await airdrop();
        const [profilePda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('USER_STATE'),
                authority.publicKey.toBuffer(),
            ],
            program.programId
        );

        await program.methods
            .initializeUser('new github')
            .accounts({
                authority: authority.publicKey,
                userProfile: profilePda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([authority])
            .rpc();

        userProfile = profilePda;
    });

    it('Add repo', async () => {
        const account = await program.account.userProfile.fetch(userProfile);

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
                userProfile: userProfile,
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

        await program.methods
            .addTodo(0, 'test')
            .accounts({
                authority: authority.publicKey,
                repoAccount: userRepo,
                systemProgram: anchor.web3.SystemProgram.programId,
                todoAccount: ticketPda,
            })
            .signers([authority])
            .rpc();

        const ticket = await program.account.userTickets.fetch(ticketPda);
        console.log(ticket);
    });
});
