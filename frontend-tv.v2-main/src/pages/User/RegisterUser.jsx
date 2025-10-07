import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Field, Form } from "formik";
import * as Yup from "yup";
import hidden__Password from "../../../public/images/hide-password.png";
import show__Password from "../../../public/images/show-password.png";
import Swal from "sweetalert2";
import api from '../../utils/api'

const RegisterSchema = Yup.object().shape({
    username: Yup.string().required("Campo obligatorio"),
    email: Yup.string()
        .required("Campo obligatorio").matches(/grupogtd.com/, "Debe pertenecer al dominio grupogtd.com")
        .email("Debe ser un correo válido"),
    confirmPassword: Yup.string()
        .required("Campo obligatorio"),
    password: Yup.string()
        .required("La contraseña es obligatoria")
        .min(8, "Debe tener al menos 8 caracteres")
        .matches(/[A-Z]/, "Debe tener al menos una letra mayúscula")
        .matches(/[a-z]/, "Debe tener al menos una letra minúscula")
        .matches(/[0-9]/, "Debe tener al menos un número")
        .matches(
            /[@$!%*?&]/,
            "Debe tener al menos un símbolo especial (@$!%*?&)"
    )
    
        .oneOf([Yup.ref("password")], "Las contraseñas deben coincidir")
        .required("Confirma tu contraseña"),
});

const RegisterUser = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const toggleShowPassword = () => setShowPassword(!showPassword);
    const toggleShowConfirmPassword = () =>
        setShowConfirmPassword(!showConfirmPassword);

    return (
        <div className="outlet-main">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/listar-user">Listar</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                        Registrar Usuario
                    </li>
                </ol>
            </nav>

            <Formik
                initialValues={{
                    username: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
                }}
                validationSchema={RegisterSchema}
                onSubmit={async (values, { resetForm }) => {
                     
                    try {
                        await api.createUser(values)
                        Swal.fire({
                            icon: "success",
                            title: "Usuario registrado",
                            text: "El usuario se ha registrado exitosamente!",
                            footer: `<h4>${values.email}</h4>`,
                        });
                        resetForm();
                    } catch (error) {
                        Swal.fire({
                            icon: "error",
                            title: "Ups!!",
                            text: `${error.response.data.message}`,
                            footer: `${values.email}`,
                        });
                         
                    }
                }}
            >
                {({ errors, touched, values, setFieldValue }) => {
                    const rules = {
                        minLength: values.password.length >= 8,
                        hasUpperCase: /[A-Z]/.test(values.password),
                        hasLowerCase: /[a-z]/.test(values.password),
                        hasNumber: /[0-9]/.test(values.password),
                        hasSpecialChar: /[@$!%*?&]/.test(values.password),
                        domain: /@grupogtd.com/.test(values.email)
                    };

                    return (
                        <div className="container-form-brother">
                            <Form className="form__add">
                                <h1 className="form__titulo">Registrar</h1>

                                <div className="form__group">
                                    <label
                                        htmlFor="username"
                                        className="form__group-label"
                                    >
                                        Nombre:
                                    </label>
                                    <Field
                                        className="form__group-input"
                                        type="text"
                                        name="username"
                                        id="username"
                                    />
                                    {errors.username && touched.username && (
                                        <div className="form__group-error">
                                            {errors.username}
                                        </div>
                                    )}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="email"
                                        className="form__group-label"
                                    >
                                        Email:
                                    </label>
                                    <Field
                                        className="form__group-input"
                                        type="email"
                                        name="email"
                                        id="email"
                                        onChange={(e) => setFieldValue("email", e.target.value.toLowerCase())}
                                    />
                                    {errors.email && touched.email && (
                                        <div className="form__group-error">
                                            {errors.email}
                                        </div>
                                    )}
                                </div>

                                {/* Password */}
                                <div
                                    className="form__group"
                                    style={{ position: "relative" }}
                                >
                                    <label
                                        htmlFor="password"
                                        className="form__group-label"
                                    >
                                        Password:
                                    </label>
                                    <Field
                                        className="form__group-input"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        name="password"
                                        id="password"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="icon__password-toggle"
                                        onClick={toggleShowPassword}
                                        style={{
                                            position: "absolute",
                                            right: 5,
                                            top: 28,
                                        }}
                                    >
                                        {showPassword ? (
                                            <img
                                                className="icon__password"
                                                src={hidden__Password}
                                                alt="ocultar"
                                            />
                                        ) : (
                                            <img
                                                className="icon__password"
                                                src={show__Password}
                                                alt="mostrar"
                                            />
                                        )}
                                    </button>
                                    {errors.password && touched.password && (
                                        <div className="form__group-error">
                                            {errors.password}
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div
                                    className="form__group"
                                    style={{ position: "relative" }}
                                >
                                    <label
                                        htmlFor="confirmPassword"
                                        className="form__group-label"
                                    >
                                        Confirmar Password:
                                    </label>
                                    <Field
                                        className="form__group-input"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        name="confirmPassword"
                                        id="confirmPassword"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="icon__password-toggle"
                                        onClick={toggleShowConfirmPassword}
                                        style={{
                                            position: "absolute",
                                            right: 5,
                                            top: 28,
                                        }}
                                    >
                                        {showConfirmPassword ? (
                                            <img
                                                className="icon__password"
                                                src={hidden__Password}
                                                alt="ocultar"
                                            />
                                        ) : (
                                            <img
                                                className="icon__password"
                                                src={show__Password}
                                                alt="mostrar"
                                            />
                                        )}
                                    </button>
                                    {errors.confirmPassword &&
                                        touched.confirmPassword && (
                                            <div className="form__group-error">
                                                {errors.confirmPassword}
                                            </div>
                                        )}
                                </div>

                                <button
                                    className="button btn-success"
                                    type="submit"
                                >
                                    Enviar
                                </button>
                            </Form>

                            {/* Checklist dinámico */}
                            <div>
                                <div style={{ marginTop: "10px" }}>

                                    <p>El dominio del correo debe ser institucional:</p>
                                    <ul
                                        style={{
                                            listStyle: "none",
                                            paddingLeft: 0,
                                        }}
                                    >
                                    <li
                                        style={{
                                            color: rules.domain
                                                ? "green"
                                                : "red",
                                        }}
                                    >
                                        {rules.domain ? "✔" : "✖"} Dominio (@grupogtd.com)
                                    </li>

                                    </ul>
                                </div>
                                <div style={{ marginTop: "10px" }}>
                                    <p>La contraseña debe contener:</p>
                                    <ul
                                        style={{
                                            listStyle: "none",
                                            paddingLeft: 0,
                                        }}
                                    >
                                        <li
                                            style={{
                                                color: rules.minLength
                                                    ? "green"
                                                    : "red",
                                            }}
                                        >
                                            {rules.minLength ? "✔" : "✖"} Mínimo 8
                                            caracteres
                                        </li>
                                        <li
                                            style={{
                                                color: rules.hasUpperCase
                                                    ? "green"
                                                    : "red",
                                            }}
                                        >
                                            {rules.hasUpperCase ? "✔" : "✖"} Una
                                            letra mayúscula
                                        </li>
                                        <li
                                            style={{
                                                color: rules.hasLowerCase
                                                    ? "green"
                                                    : "red",
                                            }}
                                        >
                                            {rules.hasLowerCase ? "✔" : "✖"} Una
                                            letra minúscula
                                        </li>
                                        <li
                                            style={{
                                                color: rules.hasNumber
                                                    ? "green"
                                                    : "red",
                                            }}
                                        >
                                            {rules.hasNumber ? "✔" : "✖"} Un número
                                        </li>
                                        <li
                                            style={{
                                                color: rules.hasSpecialChar
                                                    ? "green"
                                                    : "red",
                                            }}
                                        >
                                            {rules.hasSpecialChar ? "✔" : "✖"} Un
                                            símbolo especial (@$!%*?&)
                                        </li>

                                    </ul>
                                </div>
                            </div>
                            
                        </div>
                    );
                }}
            </Formik>
        </div>
    );
};

export default RegisterUser;
