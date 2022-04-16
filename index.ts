// #region 'Importing and configuration of Prisma'
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

const app = express();
app.use(cors());
app.use(express.json());
// #endregion

app.get('/', async (req, res) => {
    res.send('Server Up and Running');
});

function createToken(id: number) {
    //@ts-ignore
    const token = jwt.sign({ id: id }, process.env.MY_SECRET, {
        expiresIn: '3days',
    });
    return token;
}

async function getUserFromToken(token: string) {
    //@ts-ignore
    const data = jwt.verify(token, process.env.MY_SECRET);
    const user = await prisma.user.findUnique({
        // @ts-ignore
        where: { id: data.id },
    });

    return user;
}

app.get('/movies', async (req, res) => {
    try {
        const movies = await prisma.movie.findMany({
            include: { genres: true },
        });
        res.send(movies);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.get('/movies/page/:pagenr', async (req, res) => {
    const page = Number(req.params.pagenr);
    const nrToSkip = (page - 1) * 20;

    try {
        const movies = await prisma.movie.findMany({
            include: { genres: { include: { genre: true } } },
            skip: nrToSkip,
            take: 20,
        });
        res.send(movies);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

//get movie count
app.get('/movie-count', async (req, res) => {
    try {
        const count = await prisma.movie.count();
        res.send({ count });
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.get('/movie/:title', async (req, res) => {
    const title = req.params.title
        .split('')
        .map((char) => (char === '-' ? ' ' : char))
        .join('');

    try {
        const movie = await prisma.movie.findFirst({
            where: { title },
            include: { genres: { include: { genre: true } } },
        });
        res.send(movie);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.get('/comments', async (req, res) => {
    try {
        const comments = await prisma.comment.findMany();
        res.send(comments);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.get('/favorites', async (req, res) => {
    const token = req.headers.authorization || '';
    try {
        const user = await getUserFromToken(token);

        const favorites = await prisma.favorite.findMany({
            where: { userId: user?.id },
        });
        res.send(favorites);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.post('/favorites', async (req, res) => {
    const token = req.headers.authorization || '';
    const { movieId } = req.body;

    try {
        const user = await getUserFromToken(token);

        const favorite = await prisma.favorite.create({
            //@ts-ignore
            data: { userId: user.id, movieId: movieId },
        });
        const favorites = await prisma.favorite.findMany({
            where: { userId: user?.id },
        });
        const generes = await prisma.genre.findMany();
        //@ts-ignore
        user.favorites = favorites;
        //@ts-ignore
        user.generes = generes;

        res.send(user);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.get('/genres', async (req, res) => {
    try {
        const generes = await prisma.genre.findMany();
        res.send(generes);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.post('/sign-up', async (req, res) => {
    const { email, password, userName } = req.body;

    try {
        const hash = bcrypt.hashSync(password);
        const user = await prisma.user.create({
            data: { email: email, password: hash, userName: userName },
        });
        res.send({ user, token: createToken(user.id) });
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email: email },
        });
        // @ts-ignore
        const passwordMatches = bcrypt.compareSync(password, user.password);
        if (user && passwordMatches) {
            res.send({ user, token: createToken(user.id) });
        } else {
            throw Error('Boom');
        }
    } catch (err) {
        res.status(400).send({ error: 'Email/password invalid.' });
    }
});

app.get('/validate', async (req, res) => {
    const token = req.headers.authorization || '';

    try {
        const user = await getUserFromToken(token);
        res.send(user);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

//search endpoint
app.post('/search', async (req, res) => {
    const { title } = req.body;

    try {
        const movies = await prisma.movie.findMany({
            where: {
                title: { contains: title },
            },
            include: { genres: { include: { genre: true } } },
        });
        res.send(movies);
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

//genre endpoint
app.get('/genres/:genre', async (req, res) => {
    const genre = req.params.genre;
    let page = Number(req.query.page);
    const genreId = await prisma.genre.findFirst({
        where: { name: genre },
    });
    const count = await prisma.movieGenre.count({
        where: {
            genreId: genreId?.id,
        },
    });

    try {
        const movies = await prisma.movie.findMany({
            where: {
                genres: {
                    some: {
                        genre: {
                            name: genre,
                        },
                    },
                },
            },
            include: { genres: { include: { genre: true } } },take: 20,skip: (page - 1) * 20,
        });
        res.send({ movies, count });
    } catch (err) {
        // @ts-ignore
        res.status(400).send({ error: err.message });
    }
});

app.listen(4000, () => {
    console.log(`Server up: http://localhost:4000`);
});

